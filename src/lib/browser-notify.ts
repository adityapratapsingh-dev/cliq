/**
 * Thin wrapper around the Web Notifications API.
 *
 * Every entry point is defensive: the API is missing in some webviews, blocked
 * on insecure origins, and permission can be denied. None of those should throw
 * into React render.
 */

const STORAGE_KEY = "cliq:push-enabled";

export function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function browserNotificationsEnabled(): boolean {
  if (!browserNotificationsSupported()) return false;
  return Notification.permission === "granted";
}

/**
 * Ask for permission. Returns whether notifications are now enabled.
 *
 * We persist the user's intent so the UI can reflect it, but the real gate is
 * always `Notification.permission`.
 */
export async function enableBrowserNotifications(): Promise<boolean> {
  if (!browserNotificationsSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    const granted = permission === "granted";
    window.localStorage.setItem(STORAGE_KEY, granted ? "1" : "0");
    return granted;
  } catch {
    return false;
  }
}

export function disableBrowserNotifications(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "0");
  } catch {
    /* ignore */
  }
}

export function pushPreferenceStored(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/**
 * Show a native notification.
 *
 * Silently does nothing when unsupported, not granted, or when the tab is
 * already focused (the in-app banner covers that case).
 */
export function showBrowserNotification(title: string, body: string, tag?: string): void {
  if (!browserNotificationsEnabled()) return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    new Notification(title, { body, tag, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}
