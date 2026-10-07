const CACHE_NAME = "sobrenatural-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./logo-iglesia.png",
  "./fondo-inicio.png",
  "./biblia.png",
  "./fondo-nombre.PNG",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (_) {
            // Si algún recurso aún no existe, no bloquea la instalación.
          }
        })
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Supabase y cualquier otro dominio externo siempre van directo a internet.
  if (url.origin !== self.location.origin) return;

  // Navegación: intenta internet primero; si no hay conexión, usa la app guardada.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("./index.html"))
          );
        })
    );
    return;
  }

  // Archivos locales: internet primero para recibir cambios nuevos,
  // con respaldo del caché si no hay conexión.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Base preparada para las notificaciones push que agregaremos después.
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      body: event.data ? event.data.text() : "Tienes una nueva notificación."
    };
  }

  const title = data.title || "Iglesia Sobrenatural";

  const options = {
    body: data.body || "Tienes una nueva notificación.",
    icon: data.icon || "./icon-192.png",
    badge: data.badge || "./icon-192.png",
    data: {
      url: data.url || "./",
      ...(data.data || {})
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url ||
    "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
