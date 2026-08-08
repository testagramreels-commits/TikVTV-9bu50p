/**
 * push-notify Edge Function — sends Web Push notifications to subscribers.
 *
 * Actions:
 *  - subscribe:   Save a push subscription endpoint for a user
 *  - unsubscribe: Remove a subscription
 *  - send:        Send a push notification to a user or all subscribers
 *
 * Uses VAPID keys stored as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.
 * Web Push via the Web Crypto API (no external library needed).
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT     = 'mailto:support@tikvtv.app';

// ── Minimal Web Push implementation using Web Crypto ──────────────────
// For production, use a proper VAPID library. This is a simplified version.

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function createVapidToken(audience: string): Promise<string> {
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200, // 12h
    sub: VAPID_SUBJECT,
  };

  const toSign = `${base64urlEncode(new TextEncoder().encode(JSON.stringify(header)))}.${base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))}`;

  const keyBytes = base64urlDecode(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(toSign));

  return `${toSign}.${base64urlEncode(sig)}`;
}

async function sendPushMessage(subscription: {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}, payload: string): Promise<{ ok: boolean; status?: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured');
    return { ok: false };
  }

  try {
    const url      = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const token    = await createVapidToken(audience);

    const res = await fetch(subscription.endpoint, {
      method:  'POST',
      headers: {
        'Authorization': `vapid t=${token},k=${VAPID_PUBLIC_KEY}`,
        'Content-Type':  'application/octet-stream',
        'TTL':           '86400',
        'Content-Encoding': 'aes128gcm',
      },
      body: new TextEncoder().encode(payload),
    });

    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error('[Push] send error:', e);
    return { ok: false };
  }
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
    console.log('[push-notify] action:', action);

    // Auth check for user-scoped actions
    const authHeader = req.headers.get('Authorization');
    const jwt        = authHeader?.replace('Bearer ', '');
    let user: { id: string } | null = null;
    if (jwt) {
      const { data } = await supabase.auth.getUser(jwt);
      user = data.user;
    }

    // ── Subscribe ──────────────────────────────────────────────────
    if (action === 'subscribe') {
      if (!user) return respond({ error: 'Unauthorized' }, 401);
      const { endpoint, p256dh, auth } = params as { endpoint: string; p256dh: string; auth: string };
      if (!endpoint || !p256dh || !auth) return respond({ error: 'Missing fields' }, 400);

      await supabase.from('push_subscriptions').upsert({
        user_id:  user.id,
        endpoint,
        p256dh,
        auth_key: auth,
      }, { onConflict: 'endpoint' });

      return respond({ ok: true });
    }

    // ── Unsubscribe ────────────────────────────────────────────────
    if (action === 'unsubscribe') {
      if (!user) return respond({ error: 'Unauthorized' }, 401);
      const { endpoint } = params as { endpoint: string };
      await supabase.from('push_subscriptions').delete()
        .eq('user_id', user.id).eq('endpoint', endpoint);
      return respond({ ok: true });
    }

    // ── Get VAPID public key ───────────────────────────────────────
    if (action === 'get_vapid_key') {
      return respond({ publicKey: VAPID_PUBLIC_KEY });
    }

    // ── Send notification to a user ───────────────────────────────
    if (action === 'send') {
      const { user_id, title, body, icon, url: notifUrl, data: notifData } = params as {
        user_id: string; title: string; body: string; icon?: string; url?: string; data?: unknown;
      };

      if (!user_id || !title || !body) return respond({ error: 'Missing user_id, title, or body' }, 400);

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth_key')
        .eq('user_id', user_id);

      if (!subs || subs.length === 0) return respond({ ok: true, sent: 0 });

      const payload = JSON.stringify({ title, body, icon: icon || '/manifest.json', url: notifUrl || '/', data: notifData });

      let sent = 0;
      for (const sub of subs) {
        const result = await sendPushMessage({
          endpoint: sub.endpoint,
          p256dh:   sub.p256dh,
          auth_key: sub.auth_key,
        }, payload);

        if (result.ok) {
          sent++;
        } else if (result.status === 410 || result.status === 404) {
          // Subscription expired — remove it
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }

      return respond({ ok: true, sent });
    }

    return respond({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('[push-notify] error:', err);
    return respond({ error: (err as Error).message }, 500);
  }
});
