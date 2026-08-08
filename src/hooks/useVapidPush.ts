/**
 * useVapidPush — manages Web Push subscription lifecycle.
 * Registers service worker, subscribes to push, saves to DB via edge function.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const EDGE_FN = 'push-notify';

export function useVapidPush() {
  const { user } = useAuthStore();
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [supported,   setSupported]   = useState(false);

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }, []);

  // Check current subscription state
  useEffect(() => {
    if (!supported || !user) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub);
      });
    }).catch(() => {});
  }, [supported, user]);

  const subscribe = useCallback(async () => {
    if (!user) { toast.error('Sign in to enable push notifications'); return; }
    if (!supported) { toast.error('Push notifications not supported in this browser'); return; }

    setLoading(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notification permission denied');
        setLoading(false);
        return;
      }

      // Get VAPID public key from edge function
      const { data: keyData } = await supabase.functions.invoke(EDGE_FN, {
        body: { action: 'get_vapid_key' },
      });

      const vapidKey = keyData?.publicKey;
      if (!vapidKey) {
        toast.error('Push service not configured yet');
        setLoading(false);
        return;
      }

      // Register service worker
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      const keys    = subJson.keys as { p256dh: string; auth: string };

      // Save to backend
      const { error } = await supabase.functions.invoke(EDGE_FN, {
        body: {
          action:   'subscribe',
          endpoint: sub.endpoint,
          p256dh:   keys.p256dh,
          auth:     keys.auth,
        },
      });

      if (error) throw new Error(error.message);

      setSubscribed(true);
      toast.success('Push notifications enabled! 🔔');
    } catch (e) {
      console.error('[Push] subscribe error:', e);
      toast.error('Failed to enable push notifications');
    }
    setLoading(false);
  }, [user, supported]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.functions.invoke(EDGE_FN, {
          body: { action: 'unsubscribe', endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success('Push notifications disabled');
    } catch (e) {
      console.error('[Push] unsubscribe error:', e);
    }
    setLoading(false);
  }, []);

  return { subscribed, loading, supported, subscribe, unsubscribe };
}

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const arr     = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}
