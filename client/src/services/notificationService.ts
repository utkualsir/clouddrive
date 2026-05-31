const ICON = '/icon-192.png';

export function hasNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (!hasNotificationSupport()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!hasNotificationSupport()) return 'denied';
  return Notification.requestPermission();
}

export function showDesktopNotification(
  title: string,
  body: string,
  url?: string,
): void {
  if (!hasNotificationSupport()) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return; // Only show when tab is in background

  const notif = new Notification(title, {
    body,
    icon: ICON,
    tag: title,
  });

  notif.onclick = () => {
    window.focus();
    if (url) window.location.href = url;
    notif.close();
  };

  setTimeout(() => notif.close(), 5000);
}
