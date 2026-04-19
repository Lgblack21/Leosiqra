import { boot } from "/js/app/main.js";

boot().catch((error) => {
  const app = document.querySelector("#app");
  if (!app) return;
  app.innerHTML = `
    <main class="dashboard-shell shell-error">
      <section class="panel">
        <span class="eyebrow">Runtime Error</span>
        <h1>Terjadi error</h1>
        <p>${error.message}</p>
      </section>
    </main>
  `;
});
