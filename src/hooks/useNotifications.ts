/**
 * Legacy notifications hook — kept for compatibility.
 * New code should use usePushNotifications instead.
 * This is a thin wrapper that delegates to usePushNotifications.
 */
export { usePushNotifications as useNotifications } from './usePushNotifications';
