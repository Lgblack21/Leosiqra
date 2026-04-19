export function renderShell({ title, route, user, turnstileSiteKey }) {
  const bootstrap = JSON.stringify({ route, user, turnstileSiteKey: turnstileSiteKey || "" });
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="Leosiqra adalah dashboard finansial pribadi premium dengan alur member yang cepat dipahami, mobile-friendly, dan berjalan penuh di Cloudflare." />
    <meta name="theme-color" content="#10243b" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script>window.__BOOTSTRAP__ = ${bootstrap};</script>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}
