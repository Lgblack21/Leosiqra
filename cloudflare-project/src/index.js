import { handleAdmin } from "./api/admin.js";
import { handleAuth } from "./api/auth.js";
import { handleResources } from "./api/resources.js";
import { handleUploads } from "./api/uploads.js";
import { getSessionContext } from "./middleware/auth.js";
import { renderPage } from "./pages/app.js";
import { html, serverError } from "./utils/http.js";

function isAppRoute(pathname) {
  if (["/", "/login", "/register", "/dashboard", "/admin", "/profile"].includes(pathname)) return true;
  if (pathname.startsWith("/membership/")) return true;
  if (pathname.startsWith("/admin/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const sessionContext = await getSessionContext(request, env);
      for (const handler of [handleAuth, handleUploads, handleAdmin, handleResources]) {
        const response = await handler(request, env, sessionContext);
        if (response) return response;
      }
      if (isAppRoute(url.pathname)) {
        return html(renderPage({ route: url.pathname, user: sessionContext?.user || null, turnstileSiteKey: env.TURNSTILE_SITE_KEY || "" }));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return serverError(error);
    }
  }
};
