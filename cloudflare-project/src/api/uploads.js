import { createId, first, fromRow, nowIso, run } from "../utils/db.js";
import { badRequest, json, notFound, unauthorized } from "../utils/http.js";

function sanitizeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function handleUploads(request, env, sessionContext) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/uploads")) return null;
  if (!sessionContext) return unauthorized();

  if (request.method === "POST" && url.pathname === "/api/uploads") {
    const form = await request.formData();
    const file = form.get("file");
    const category = String(form.get("category") || "misc");
    if (!(file instanceof File)) return badRequest("File wajib diunggah.");

    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const objectKey = `${sessionContext.user.id}/${category}/${Date.now()}-${sanitizeFileName(file.name.replace(ext, ""))}${ext}`;
    await env.FILES.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { userId: sessionContext.user.id, category }
    });

    const uploadId = createId("upl");
    await run(
      env,
      "INSERT INTO uploads (id, user_id, object_key, bucket_name, original_name, content_type, size_bytes, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      uploadId,
      sessionContext.user.id,
      objectKey,
      "FILES",
      file.name,
      file.type || null,
      file.size || 0,
      category,
      nowIso()
    );

    return json({ ok: true, data: { id: uploadId, key: objectKey, url: `/api/uploads/${encodeURIComponent(objectKey)}` } }, { status: 201 });
  }

  if (request.method === "GET" && url.pathname === "/api/uploads") {
    const rows = await env.DB.prepare("SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at DESC").bind(sessionContext.user.id).all();
    return json({ ok: true, data: (rows.results || []).map(fromRow) });
  }

  if (request.method === "GET") {
    const objectKey = decodeURIComponent(url.pathname.replace("/api/uploads/", ""));
    const record = await first(env, "SELECT * FROM uploads WHERE object_key = ? LIMIT 1", objectKey);
    if (!record) return notFound();
    if (sessionContext.user.role !== "admin" && record.user_id !== sessionContext.user.id) return unauthorized();
    const object = await env.FILES.get(objectKey);
    if (!object) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, max-age=300");
    return new Response(object.body, { headers });
  }

  return null;
}
