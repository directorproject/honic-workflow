self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Project update";
  const body = data.body || "There is a new update on this shared project.";
  const url = data.url || "/";
  const tag = data.tag || "project-update";
  const vibrate = Array.isArray(data.vibrate) ? data.vibrate : [120, 60, 120];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      vibrate,
      renotify: true,
      requireInteraction: false,
      silent: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
