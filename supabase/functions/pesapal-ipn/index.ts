/**
 * PesaPal IPN (Instant Payment Notification) handler
 * PesaPal calls this endpoint when payment status changes
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const orderTrackingId = url.searchParams.get('OrderTrackingId') || url.searchParams.get('orderTrackingId');
  const merchantRef     = url.searchParams.get('OrderMerchantReference') || url.searchParams.get('orderMerchantReference');
  const status          = url.searchParams.get('OrderNotificationType') || url.searchParams.get('orderNotificationType');

  console.log('[IPN] Received:', { orderTrackingId, merchantRef, status });

  if (!orderTrackingId) {
    return new Response('Missing orderTrackingId', { status: 400, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Mark as completed on IPNCHANGE or IPLASTNOTIFY
    if (status === 'IPNCHANGE' || status === 'IPLASTNOTIFY') {
      const { error } = await supabase
        .from('premium_subscriptions')
        .update({ status: 'completed' })
        .eq('pesapal_tracking', orderTrackingId);

      if (error) console.error('[IPN] DB update error:', error);
      else console.log('[IPN] Premium activated for tracking:', orderTrackingId);
    }

    return new Response(JSON.stringify({ status: 'OK' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[IPN] Error:', err);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
});
