/**
 * PesaPal payment Edge Function
 * Handles: IPN registration, order submission, order status check
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PESAPAL_BASE = 'https://pay.pesapal.com/v3';
const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')    ?? '';
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET') ?? '';

interface TokenResponse { token: string; expiryDate: string; }

async function getAccessToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  });
  if (!res.ok) throw new Error(`PesaPal auth failed: ${res.status}`);
  const data: TokenResponse = await res.json();
  return data.token;
}

async function registerIPN(token: string, ipnUrl: string): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: 'GET' }),
  });
  if (!res.ok) throw new Error(`IPN registration failed: ${res.status}`);
  const data = await res.json();
  return data.ipn_id;
}

async function submitOrder(token: string, params: {
  ipn_id: string; amount: number; currency: string;
  description: string; reference: string;
  email: string; phone?: string; first_name?: string; last_name?: string;
  callback_url: string;
}): Promise<{ order_tracking_id: string; merchant_reference: string; redirect_url: string }> {
  const res = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: params.reference,
      currency: params.currency,
      amount: params.amount,
      description: params.description,
      callback_url: params.callback_url,
      redirect_mode: '',
      notification_id: params.ipn_id,
      billing_address: {
        email_address: params.email,
        phone_number: params.phone || '',
        first_name: params.first_name || 'User',
        last_name: params.last_name || '',
        country_code: 'KE',
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Order submit failed: ${res.status} — ${errText}`);
  }
  return await res.json();
}

async function getOrderStatus(token: string, orderTrackingId: string): Promise<{
  payment_status_description: string;
  amount: number;
  currency: string;
  payment_method: string;
}> {
  const res = await fetch(
    `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { action, ...params } = await req.json();
    console.log('[PesaPal] action:', action);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const token_jwt  = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token_jwt);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken();

    if (action === 'initiate') {
      const { amount = 9.99, currency = 'USD', plan = 'monthly', callback_url } = params;
      const reference = `tikvtv-${user.id}-${Date.now()}`;
      
      // Register IPN
      const ipnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pesapal-ipn`;
      let ipn_id = '';
      try {
        ipn_id = await registerIPN(accessToken, ipnUrl);
      } catch (e) {
        console.warn('[PesaPal] IPN registration failed (continuing):', e);
        ipn_id = 'default';
      }

      // Get user profile for billing info
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      const emailAddr = user.email || profile?.email || 'user@example.com';
      const nameParts = (profile?.username || 'TikVTV User').split(' ');

      const orderResult = await submitOrder(accessToken, {
        ipn_id,
        amount,
        currency,
        description: `TikVTV Premium - ${plan}`,
        reference,
        email: emailAddr,
        first_name: nameParts[0] || 'User',
        last_name: nameParts[1] || '',
        callback_url: callback_url || `${Deno.env.get('SUPABASE_URL')}/payment-callback`,
      });

      // Save pending subscription
      await supabase.from('premium_subscriptions').upsert({
        user_id: user.id,
        pesapal_order_id: reference,
        pesapal_tracking: orderResult.order_tracking_id,
        amount,
        currency,
        plan,
        status: 'pending',
        expires_at: new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 86400000).toISOString(),
      }, { onConflict: 'user_id' });

      console.log('[PesaPal] Order created:', orderResult.order_tracking_id);
      return new Response(JSON.stringify({
        redirect_url: orderResult.redirect_url,
        order_tracking_id: orderResult.order_tracking_id,
        merchant_reference: reference,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'check_status') {
      const { order_tracking_id } = params;
      const status = await getOrderStatus(accessToken, order_tracking_id);
      const isPaid = status.payment_status_description?.toLowerCase() === 'completed';

      if (isPaid) {
        await supabase.from('premium_subscriptions').update({
          status: 'completed',
        }).eq('pesapal_tracking', order_tracking_id).eq('user_id', user.id);
      }

      return new Response(JSON.stringify({ status: status.payment_status_description, isPaid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check_premium') {
      const { data: sub } = await supabase
        .from('premium_subscriptions')
        .select('status, expires_at, plan')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      return new Response(JSON.stringify({ isPremium: !!sub, subscription: sub }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[PesaPal] Error:', err);
    return new Response(JSON.stringify({ error: `PesaPal: ${(err as Error).message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
