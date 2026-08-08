/**
 * PesaPal IPN (Instant Payment Notification) handler
 * PesaPal sends GET requests when payment status changes
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PESAPAL_BASE    = 'https://pay.pesapal.com/v3';
const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')    ?? '';
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET') ?? '';

async function getPesaPalToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function getTransactionStatus(token: string, orderTrackingId: string) {
  const res = await fetch(
    `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url              = new URL(req.url);
  const orderTrackingId  = url.searchParams.get('OrderTrackingId')         || url.searchParams.get('orderTrackingId');
  const merchantRef      = url.searchParams.get('OrderMerchantReference')  || url.searchParams.get('orderMerchantReference');
  const notifType        = url.searchParams.get('OrderNotificationType')   || url.searchParams.get('orderNotificationType');

  console.log('[IPN] Received:', { orderTrackingId, merchantRef, notifType });

  if (!orderTrackingId) {
    return new Response('Missing orderTrackingId', { status: 400, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Always verify payment status directly from PesaPal API
    let isPaid = false;
    try {
      const token  = await getPesaPalToken();
      const status = await getTransactionStatus(token, orderTrackingId);
      isPaid = status.payment_status_description?.toLowerCase() === 'completed';
      console.log('[IPN] Verified status:', status.payment_status_description);
    } catch (e) {
      console.error('[IPN] Status verify error:', e);
      // Fallback: trust the notification type
      isPaid = notifType === 'IPNCHANGE' || notifType === 'IPLASTNOTIFY';
    }

    if (isPaid) {
      const { error } = await supabase
        .from('premium_subscriptions')
        .update({ status: 'completed' })
        .eq('pesapal_tracking', orderTrackingId);

      if (error) {
        console.error('[IPN] DB update error:', error);
      } else {
        console.log('[IPN] Premium ACTIVATED for tracking:', orderTrackingId);
      }
    } else {
      console.log('[IPN] Payment not yet completed. Status notification recorded.');
    }

    // PesaPal expects a specific JSON response
    return new Response(
      JSON.stringify({ orderNotificationType: notifType, orderTrackingId, orderMerchantReference: merchantRef, status: 200 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[IPN] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
