// 핏코치 커스텀 서비스워커 조각 — workbox 생성 SW 에 importScripts 로 합쳐진다.
// 역할: 알림(Notification)을 탭하면 앱 창을 열거나(닫혀 있을 때) 포커스(열려 있을 때)한다.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = (event.notification.data && event.notification.data.url) || '/';
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 이미 열린 앱 창이 있으면 그걸 포커스
      for (const w of wins) {
        if ('focus' in w) {
          try { await w.navigate(url); } catch (_) { /* 일부 브라우저 미지원 */ }
          return w.focus();
        }
      }
      // 없으면 새 창으로 앱 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })()
  );
});
