import { APP_NAME } from "../utils/constants.js";
import { renderShell } from "../components/layout.js";

export function renderPage({ route, user, turnstileSiteKey }) {
  const titles = {
    "/": `${APP_NAME} | Dashboard Finansial Pribadi Premium`,
    "/login": `Login | ${APP_NAME}`,
    "/auth/login": `Login | ${APP_NAME}`,
    "/register": `Register | ${APP_NAME}`,
    "/auth/register": `Register | ${APP_NAME}`,
    "/dashboard": `Dashboard | ${APP_NAME}`,
    "/admin": `Admin | ${APP_NAME}`,
    "/profile": `Profile | ${APP_NAME}`
  };
  let title = titles[route] || APP_NAME;
  if (route.startsWith("/membership/")) title = `Membership | ${APP_NAME}`;
  if (route.startsWith("/admin/")) title = `Admin | ${APP_NAME}`;
  return renderShell({ title, route, user, turnstileSiteKey });
}
