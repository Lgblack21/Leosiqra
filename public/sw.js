// Service worker minimal untuk Web Push — cuma nampilin notifikasi & buka
// halaman terkait saat diklik, tidak melakukan caching/offline apa pun.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Leosiqra", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Leosiqra";
  const options = {
    body: data.body || "",
    icon: "/images/Logo-new.png",
    badge: "/images/Logo-new.png",
    data: { url: data.url || "/membership/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/membership/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })
  );
});
