import { bindGlobalActions, bindMarketingInteractions, bindPublicTopbar, guardRoute, setView, state } from "./core.js";
import { adminData, authPage, heroPage, memberData, renderAdminLoading, renderAdminPage, renderMemberLoading, renderMemberPage } from "./pages.js";

export async function boot() {
  const allowed = await guardRoute();
  if (!allowed) return;

  if (state.route === "/") {
    heroPage();
    bindMarketingInteractions();
    return;
  }
  if (["/login", "/auth/login"].includes(state.route)) {
    authPage("login");
    bindPublicTopbar();
    return;
  }
  if (["/register", "/auth/register"].includes(state.route)) {
    authPage("register");
    bindPublicTopbar();
    return;
  }
  if (state.route === "/dashboard") {
    window.location.replace("/membership/dashboard");
    return;
  }
  if (state.route === "/profile") {
    window.location.replace(state.user?.role === "admin" ? "/admin/pengaturan" : "/membership/profile");
    return;
  }
  if (state.route === "/admin") {
    window.location.replace("/admin/dashboard");
    return;
  }

  if (state.route.startsWith("/membership/")) {
    renderMemberLoading();
    setView(renderMemberPage(await memberData()), bindGlobalActions);
    return;
  }

  if (state.route.startsWith("/admin")) {
    renderAdminLoading();
    setView(renderAdminPage(await adminData()), bindGlobalActions);
    return;
  }

  heroPage();
  bindMarketingInteractions();
}
