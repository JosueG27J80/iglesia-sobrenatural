const CACHE_NAME = "sobrenatural-v4";

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

// Archivos que queremos servir inmediatamente desde caché.
const STATIC_FILES = new Set(
  APP_SHELL
    .filter((item) => item !== "./")
    .map((item) => new URL(item, self.location.href).href)
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Supabase y cualquier dominio externo siempre van directo a internet.
  if (url.origin !== self.location.origin) return;

  // Navegación:
  // intenta internet primero para obtener el HTML nuevo;
  // si no hay conexión, abre la copia guardada.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", copy);
            });
          }
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

  // Imágenes, CSS, JS, manifest e iconos:
  // mostrar INMEDIATAMENTE la copia del teléfono.
  // Si no existe todavía, se descarga y se guarda.
  if (
    STATIC_FILES.has(url.href) ||
    ["style", "script", "image", "font", "manifest"].includes(request.destination)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Resto de recursos locales.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Base preparada para notificaciones push.
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

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url ||
    "./";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true
      })
      .then((windowClients) => {
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