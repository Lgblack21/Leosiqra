import { computeDashboardSummary, createResource, deleteResource, getResourceById, listResource, updateResource } from "../utils/db.js";
import { badRequest, json, notFound, unauthorized } from "../utils/http.js";
import { RESOURCE_CONFIG } from "../utils/constants.js";

export async function handleResources(request, env, sessionContext) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  if (url.pathname === "/api/dashboard/summary") {
    if (!sessionContext) return unauthorized();
    return json({ ok: true, data: await computeDashboardSummary(env, sessionContext.user.id, url.searchParams.get("month")) });
  }

  if (url.pathname === "/api/profile") {
    if (!sessionContext) return unauthorized();
    if (request.method === "GET") return json({ ok: true, data: sessionContext.user });
    if (request.method === "PATCH") {
      const body = await request.json();
      const updates = {
        name: body?.name || sessionContext.user.name,
        whatsapp: body?.whatsapp || null,
        address: body?.address || null,
        username: body?.username || null,
        photoUrl: body?.photoUrl || null
      };
      await env.DB.prepare("UPDATE users SET name = ?, whatsapp = ?, address = ?, username = ?, photo_url = ?, updated_at = ? WHERE id = ?")
        .bind(updates.name, updates.whatsapp, updates.address, updates.username, updates.photoUrl, new Date().toISOString(), sessionContext.user.id)
        .run();
      return json({ ok: true, data: updates });
    }
  }

  const parts = url.pathname.replace(/^\/api\//, "").split("/");
  const resource = parts[0];
  if (!RESOURCE_CONFIG[resource]) return null;
  if (!sessionContext) return unauthorized();

  const id = parts[1];
  if (request.method === "GET" && !id) return json({ ok: true, data: await listResource(env, resource, sessionContext.user.id, Object.fromEntries(url.searchParams.entries())) });
  if (request.method === "POST" && !id) return json({ ok: true, data: await createResource(env, resource, sessionContext.user.id, (await request.json()) || {}) }, { status: 201 });
  if (!id) return badRequest("ID resource tidak ditemukan.");
  if (request.method === "GET") {
    const record = await getResourceById(env, resource, sessionContext.user.id, id);
    return record ? json({ ok: true, data: record }) : notFound();
  }
  if (request.method === "PATCH") {
    const updated = await updateResource(env, resource, sessionContext.user.id, id, (await request.json()) || {});
    return updated ? json({ ok: true, data: updated }) : notFound();
  }
  if (request.method === "DELETE") {
    await deleteResource(env, resource, sessionContext.user.id, id);
    return json({ ok: true });
  }
  return badRequest("Metode tidak didukung.");
}
