export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

export function html(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

export function badRequest(message, details) {
  return json({ ok: false, error: message, details }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return json({ ok: false, error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return json({ ok: false, error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return json({ ok: false, error: message }, { status: 404 });
}

export function serverError(error) {
  return json(
    {
      ok: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    },
    { status: 500 }
  );
}
