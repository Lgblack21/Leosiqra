import { all, createId, first, fromRow, getSettings, nowIso, run, saveSettings } from "../utils/db.js";
import { badRequest, forbidden, json, notFound, unauthorized } from "../utils/http.js";

async function addAdminLog(env, adminUser, action, target, note, color = "indigo", payload = null) {
  await run(
    env,
    "INSERT INTO admin_logs (id, admin_user_id, admin_email, action, target, note, color, payload_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    createId("log"),
    adminUser.id,
    adminUser.email,
    action,
    target,
    note,
    color,
    JSON.stringify(payload),
    nowIso()
  );
}

export async function handleAdmin(request, env, sessionContext) {
  const url = new URL(request.url);
  if (url.pathname === "/api/billing/settings" && request.method === "GET") {
    if (!sessionContext) return unauthorized();
    const settings = (await getSettings(env)) || {};
    return json({
      ok: true,
      data: {
        billingEmail: settings.billingEmail || "",
        whatsapp: settings.whatsapp || "",
        bankName: settings.bankName || "",
        bankAccountName: settings.bankAccountName || "",
        bankNumber: settings.bankNumber || "",
        qrisText: settings.qrisText || "",
        qrisURL: settings.qrisURL || "",
        proPackages: settings.proPackages || []
      }
    });
  }

  if (url.pathname === "/api/payments" && request.method === "POST") {
    if (!sessionContext) return unauthorized();
    const body = await request.json();
    const paymentId = createId("pay");
    const timestamp = nowIso();
    await run(
      env,
      `INSERT INTO payments
       (id, user_id, user_name, user_email, user_whatsapp, user_photo_url, amount, package_json, proof_image_url, note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU', ?, ?)`,
      paymentId,
      sessionContext.user.id,
      body?.userName || sessionContext.user.name,
      body?.userEmail || sessionContext.user.email,
      body?.userWhatsapp || null,
      body?.userPhotoUrl || null,
      Number(body?.amount || 0),
      JSON.stringify(body?.package || null),
      body?.proofImageUrl || null,
      body?.note || null,
      timestamp,
      timestamp
    );
    return json({ ok: true, data: { id: paymentId } }, { status: 201 });
  }

  if (url.pathname === "/api/payments" && request.method === "GET") {
    if (!sessionContext) return unauthorized();
    const rows = await all(env, "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC", sessionContext.user.id);
    return json({ ok: true, data: rows.map(fromRow) });
  }

  if (!url.pathname.startsWith("/api/admin")) return null;
  if (!sessionContext) return unauthorized();
  if (sessionContext.user.role !== "admin") return forbidden();

  if (url.pathname === "/api/admin/settings") {
    if (request.method === "GET") return json({ ok: true, data: await getSettings(env) });
    if (request.method === "PATCH") {
      const next = { ...((await getSettings(env)) || {}), ...((await request.json()) || {}) };
      await saveSettings(env, next);
      await addAdminLog(env, sessionContext.user, "UPDATE_SETTINGS", "global_config", "Mengubah konfigurasi global.");
      return json({ ok: true, data: next });
    }
  }

  if (url.pathname === "/api/admin/users") {
    const rows = await all(env, "SELECT id, email, name, role, plan, status, expired_at, whatsapp, photo_url, total_wealth, total_income, total_expenses, total_savings, total_investment, created_at FROM users ORDER BY created_at DESC");
    return json({ ok: true, data: rows.map(fromRow) });
  }

  if (url.pathname.startsWith("/api/admin/users/")) {
    const userId = url.pathname.split("/").pop();
    const body = await request.json();
    await run(
      env,
      "UPDATE users SET role = COALESCE(?, role), plan = COALESCE(?, plan), status = COALESCE(?, status), expired_at = COALESCE(?, expired_at), updated_at = ? WHERE id = ?",
      body?.role || null,
      body?.plan || null,
      body?.status || null,
      body?.expiredAt || null,
      nowIso(),
      userId
    );
    await addAdminLog(env, sessionContext.user, "UPDATE_USER", userId, "Memperbarui role/plan/status user.");
    const updated = await first(env, "SELECT id, email, name, role, plan, status, expired_at, whatsapp, photo_url FROM users WHERE id = ? LIMIT 1", userId);
    return json({ ok: true, data: updated ? fromRow(updated) : null });
  }

  if (url.pathname === "/api/admin/payments") {
    const rows = await all(env, "SELECT * FROM payments ORDER BY created_at DESC");
    return json({ ok: true, data: rows.map(fromRow) });
  }

  if (url.pathname.startsWith("/api/admin/payments/")) {
    const paymentId = url.pathname.split("/").pop();
    const payment = await first(env, "SELECT * FROM payments WHERE id = ? LIMIT 1", paymentId);
    if (!payment) return notFound("Payment tidak ditemukan.");
    const body = await request.json();
    if (!body?.status) return badRequest("Status pembayaran wajib diisi.");

    const timestamp = nowIso();
    await run(
      env,
      "UPDATE payments SET status = ?, approved_at = CASE WHEN ? = 'DISETUJUI' THEN ? ELSE approved_at END, rejected_at = CASE WHEN ? IN ('DITOLAK','GAGAL') THEN ? ELSE rejected_at END, updated_at = ? WHERE id = ?",
      body.status,
      body.status,
      timestamp,
      body.status,
      timestamp,
      timestamp,
      paymentId
    );

    if (body.status === "DISETUJUI") {
      const pkg = payment.package_json ? JSON.parse(payment.package_json) : null;
      const monthsToAdd = Number(pkg?.durationMonths || 1);
      const currentUser = await first(env, "SELECT expired_at FROM users WHERE id = ? LIMIT 1", payment.user_id);
      const startDate = currentUser?.expired_at && Date.parse(currentUser.expired_at) > Date.now() ? new Date(currentUser.expired_at) : new Date();
      const expiryDate = new Date(startDate);
      expiryDate.setMonth(expiryDate.getMonth() + monthsToAdd);
      await run(env, "UPDATE users SET plan = 'PRO', status = 'AKTIF', expired_at = ?, updated_at = ? WHERE id = ?", expiryDate.toISOString(), timestamp, payment.user_id);
    }

    await addAdminLog(env, sessionContext.user, "UPDATE_PAYMENT", payment.user_id, `Mengubah status pembayaran menjadi ${body.status}.`, "emerald");
    const updated = await first(env, "SELECT * FROM payments WHERE id = ? LIMIT 1", paymentId);
    return json({ ok: true, data: updated ? fromRow(updated) : null });
  }

  if (url.pathname === "/api/admin/logs") {
    const rows = await all(env, "SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT 100");
    return json({ ok: true, data: rows.map(fromRow) });
  }

  return null;
}
