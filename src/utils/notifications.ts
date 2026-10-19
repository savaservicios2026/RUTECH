export interface AppNotification {
  id: string;
  title: string;
  message: string;
  technicianId?: string;
  technicianName?: string;
  type: 'new_assignment' | 'urgent_change' | 'route_optimized' | 'conflict_warning';
  priority: 'baja' | 'media' | 'normal' | 'alta' | 'urgente';
  timestamp: string; // ISO or formatted
  read: boolean;
  serviceCode?: string;
  serviceId?: string;
}

/**
 * Plays a discrete audio chime using the Web Audio API without external file dependencies
 */
export function playNotificationSound(isUrgent: boolean = false) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    if (isUrgent) {
      // High urgency sound: two alert pulses
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 0.25);
    } else {
      // Pleasant chime sound (two tones: E5 -> G#5)
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(830.61, now + 0.15);
      osc2.frequency.setValueAtTime(830.61, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(987.77, now + 0.3);
    }

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isUrgent ? 0.35 : 0.45));

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + (isUrgent ? 0.35 : 0.45));
    osc2.stop(now + (isUrgent ? 0.35 : 0.45));
  } catch {
    // AudioContext blocked by autoplay policy or unsupported
  }
}

/**
 * Checks if browser supports the native Notification API
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Requests browser permission for native Web Push notifications
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'denied';
  }
}

/**
 * Returns the current Notification permission state
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Dispatches a native browser notification if granted, plus plays audio chime
 */
export function sendWebPushNotification(
  title: string,
  options: {
    body: string;
    icon?: string;
    tag?: string;
    isUrgent?: boolean;
    data?: any;
    onClick?: () => void;
  }
): boolean {
  // Always play audio alert
  playNotificationSound(options.isUrgent);

  if (!isNotificationSupported()) {
    return false;
  }

  if (Notification.permission === 'granted') {
    // Installed app (phones): notices go through the service worker, the only way Android and iPhone show them
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then((reg) =>
          reg.showNotification(title, {
            body: options.body,
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: options.tag || `rutatech-${Date.now()}`,
            requireInteraction: options.isUrgent || false,
          })
        )
        .catch(() => {});
      return true;
    }
    try {
      const notification = new Notification(title, {
        body: options.body,
        icon: options.icon || 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/navigation.svg',
        tag: options.tag || `rutatech-${Date.now()}`,
        requireInteraction: options.isUrgent || false,
      });

      if (options.onClick) {
        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };
      }

      // Auto close after 7s if not urgent
      if (!options.isUrgent) {
        setTimeout(() => {
          notification.close();
        }, 7000);
      }

      return true;
    } catch {
      // Native notification creation might be blocked in some iframe contexts
      return false;
    }
  }

  return false;
}
