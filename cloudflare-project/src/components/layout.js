export function renderShell({ title, route, user, turnstileSiteKey }) {
  const bootstrap = JSON.stringify({ route, user, turnstileSiteKey: turnstileSiteKey || "" });
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="Leosiqra Rekapan berjalan penuh di Cloudflare dengan Worker, D1, R2, dan session auth." />
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script>window.__BOOTSTRAP__ = ${bootstrap};</script>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}
