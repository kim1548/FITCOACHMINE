// 로컬 알림 유틸. (발표용: 앱이 열려 있는 동안 동작)
// 안드로이드 크롬은 new Notification() 생성자를 막아서, 서비스워커
// registration.showNotification 으로 띄운다. 데스크탑은 생성자로 폴백.

export const canNotify = () => typeof window !== "undefined" && "Notification" in window;

export async function requestNotifPermission() {
  if (!canNotify()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showLocalNotification(title, body) {
  if (!canNotify() || Notification.permission !== "granted") return false;
  const opts = {
    body,
    icon: "/pwa-192x192.png",
    badge: "/favicon-32.png",
    tag: "fitcoach-reminder",
    renotify: true,
  };
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return true;
    }
  } catch {
    /* 서비스워커 경로 실패 시 생성자 폴백 */
  }
  try {
    new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}
