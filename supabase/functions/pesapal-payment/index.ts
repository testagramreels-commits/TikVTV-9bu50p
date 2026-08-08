/**
 * PesaPal payment Edge Function — KES pricing
 * Unlimited Plan: KES 100/month
 * Pro Plan:       KES 200/month
 *
 * FIX: callback_url now passed from client (window.location.origin/premium/callback)
 *      so it correctly points to the deployed app, not Supabase URL.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PESAPAL_BASE     = 'https://pay.pesapal.com/v3';
const CONSUMER_KEY     = Deno.env.get('PESAPAL_CONSUMER_KEY')    ?? '';
const CONSUMER_SECRET  = Deno.env.get('PESAPAL_CONSUMER_SECRET') ?? '';

// ── Plan definitions (KES) ────────────────────────────────────────────
const PLANS: Record<string, { amount: number; currency: string; label: string; daysValid: number }> = {
  unlimited: { amount: 100, currency: 'KES', label: 'Unlimited Plan', daysValid: 30 },
  pro:       { amount: 200, currency: 'KES', label: 'Pro Plan',       daysValid: 30 },
};

// ── Auth token (cached in-memory) ─────────────────────────────────────
let cachedToken    = '';
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  });

  const txt = await res.text();
  console.log('[Auth] status:', res.status, 'body:', txt.slice(0, 300));

  if (!res.ok) throw new Error(`PesaPal auth failed: ${res.status} — ${txt}`);

  let data: Record<string, string>;
  try { data = JSON.parse(txt); } catch { throw new Error(`Auth parse error: ${txt.slice(0, 200)}`); }

  if (!data.token) throw new Error(`No token in auth response: ${JSON.stringify(data)}`);

  cachedToken    = data.token;
  tokenExpiresAt = data.expiryDate
    ? new Date(data.expiryDate).getTime()
    : Date.now() + 3600_000;
  return cachedToken;
}

async function registerIPN(token: string, ipnUrl: string): Promise<string> {
  try {
    const res = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url: ipnUrl, ipn_notification_type: 'GET' }),
    });
    const txt = await res.text();
    console.log('[IPN] register status:', res.status, txt.slice(0, 200));
    if (!res.ok) return '';
    const data = JSON.parse(txt);
    return data.ipn_id || '';
  } catch (e) {
    console.warn('[IPN] register error:', e);
    return '';
  }
}

interface OrderParams {
  ipn_id:       string;
  amount:       number;
  currency:     string;
  description:  string;
  reference:    string;
  email:        string;
  phone?:       string;
  first_name?:  string;
  last_name?:   string;
  callback_url: string;
}

async function submitOrder(token: string, p: OrderParams) {
  const body = {
    id:              p.reference,
    currency:        p.currency,
    amount:          p.amount,
    description:     p.description,
    callback_url:    p.callback_url,
    redirect_mode:   '',
    notification_id: p.ipn_id,
    billing_address: {
      email_address: p.email,
      phone_number:  p.phone       ?? '',
      first_name:    p.first_name  ?? 'User',
      last_name:     p.last_name   ?? '',
      country_code:  'KE',
      line_1:        '',
      city:          'Nairobi',
      state:         '',
      postal_code:   '',
      zip_code:      '',
    },
  };

  console.log('[Order] submit body:', JSON.stringify(body));

  const res = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const txt = await res.text();
  console.log('[Order] submit response:', res.status, txt.slice(0, 500));

  if (!res.ok) throw new Error(`Order submit failed: ${res.status} — ${txt}`);

  let data: Record<string, unknown>;
  try { data = JSON.parse(txt); } catch { throw new Error(`Order parse error: ${txt.slice(0, 200)}`); }

  if (data.error && typeof data.error === 'object') {
    const e = data.error as Record<string, unknown>;
    throw new Error(`PesaPal error: ${e.message || JSON.stringify(e)}`);
  }
  if (!data.redirect_url) {
    throw new Error(`No redirect_url in response: ${JSON.stringify(data)}`);
  }

  return data as { order_tracking_id: string; merchant_reference: string; redirect_url: string };
}

async function getOrderStatus(token: string, orderTrackingId: string) {
  const res = await fetch(
    `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const rawBody = await req.json();
    const { action, ...params } = rawBody;
    console.log('[PesaPal] action:', action, 'params keys:', Object.keys(params));

    // ── Authenticate user ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    const jwt        = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return respond({ error: 'Unauthorized' }, 401);

    // ── Check premium status ──────────────────────────────────────────
    if (action === 'check_premium') {
      const { data: sub } = await supabase
        .from('premium_subscriptions')
        .select('status, expires_at, plan, amount, currency')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return respond({ isPremium: !!sub, subscription: sub });
    }

    // ── Get available plans ───────────────────────────────────────────
    if (action === 'get_plans') {
      return respond({ plans: PLANS });
    }

    // ── Check order status ────────────────────────────────────────────
    if (action === 'check_status') {
      const { order_tracking_id } = params as { order_tracking_id: string };
      if (!order_tracking_id) return respond({ error: 'Missing order_tracking_id' }, 400);
      const accessToken = await getAccessToken();
      const status      = await getOrderStatus(accessToken, order_tracking_id);
      const isPaid      = status.payment_status_description?.toLowerCase() === 'completed';
      if (isPaid) {
        await supabase
          .from('premium_subscriptions')
          .update({ status: 'completed' })
          .eq('pesapal_tracking', order_tracking_id)
          .eq('user_id', user.id);
      }
      return respond({ status: status.payment_status_description, isPaid, raw: status });
    }

    // ── Initiate payment ──────────────────────────────────────────────
    if (action === 'initiate') {
      const planId   = (params.plan as string) || 'unlimited';
      const planDef  = PLANS[planId] || PLANS.unlimited;

      // callback_url MUST come from the client (window.location.origin) — not hardcoded
      const callbackUrl = (params.callback_url as string) || `${params.origin || 'https://tikvtv.onspace.app'}/premium/callback`;

      const reference   = `tv-${user.id.slice(0, 8)}-${Date.now()}`;
      const accessToken = await getAccessToken();

      // Register IPN — best-effort, don't fail if it errors
      const ipnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pesapal-ipn`;
      const ipn_id = await registerIPN(accessToken, ipnUrl);

      // Fetch user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, email')
        .eq('id', user.id)
        .maybeSingle();

      const emailAddr = user.email || profile?.email || 'user@tikvtv.app';
      const rawName   = profile?.username || user.email?.split('@')[0] || 'User';
      const [firstName, ...rest] = rawName.split(' ');

      const orderResult = await submitOrder(accessToken, {
        ipn_id,
        amount:      planDef.amount,
        currency:    planDef.currency,
        description: `TikVTV ${planDef.label}`,
        reference,
        email:       emailAddr,
        first_name:  firstName || 'User',
        last_name:   rest.join(' ') || '',
        callback_url: callbackUrl,
      });

      // Persist pending subscription
      const expiresAt = new Date(Date.now() + planDef.daysValid * 86_400_000).toISOString();
      await supabase.from('premium_subscriptions').upsert({
        user_id:          user.id,
        pesapal_order_id: reference,
        pesapal_tracking: orderResult.order_tracking_id,
        amount:           planDef.amount,
        currency:         planDef.currency,
        plan:             planId,
        status:           'pending',
        expires_at:       expiresAt,
      }, { onConflict: 'user_id' });

      console.log('[PesaPal] Order created:', orderResult.order_tracking_id);

      return respond({
        redirect_url:       orderResult.redirect_url,
        order_tracking_id:  orderResult.order_tracking_id,
        merchant_reference: reference,
        plan:               planId,
        amount:             planDef.amount,
        currency:           planDef.currency,
        label:              planDef.label,
      });
    }

    return respond({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = (err as Error).message;
    console.error('[PesaPal] Fatal error:', msg);
    return respond({ error: `PesaPal: ${msg}` }, 500);
  }
});
