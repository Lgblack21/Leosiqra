#!/usr/bin/env python3
"""Pemindai keamanan statis untuk repo Leosiqra.

Mengecek hal-hal mekanis yang gampang terlewat saat review manual:
  1. Route /api/member/* dan /api/admin/* yang handler-nya tidak memanggil requireSession
  2. Query SQL ke tabel milik user yang tidak menyebut user_id (kandidat IDOR)
  3. SQL yang disusun dengan interpolasi ${...} (kandidat SQL injection)
  4. Pesan error mentah / field debug yang dikirim ke client
  5. Pola secret yang ter-hardcode di file yang di-commit
  6. Pola berbahaya di frontend (dangerouslySetInnerHTML, eval, redirect dari query string)

Hasilnya KANDIDAT, bukan vonis — tiap temuan harus dibaca konteksnya sebelum
dilaporkan sebagai bug. Pakai:
    python3 .claude/skills/security-check/scripts/scan.py            # seluruh repo
    python3 .claude/skills/security-check/scripts/scan.py --json     # keluaran JSON
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, asdict

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or os.getcwd()
WORKER = os.path.join(ROOT, "cloudflare", "src", "index.ts")

# Tabel yang barisnya milik satu user — query ke sini tanpa user_id perlu dicek.
USER_TABLES = [
    "transactions", "accounts", "savings", "investments", "budgets", "recurring",
    "categories", "currencies", "ai_chats", "ai_chat_events", "uploads", "payments",
    "push_subscriptions", "sessions", "password_reset_tokens", "password_resets", "api_tokens",
]

# Endpoint publik yang memang boleh tanpa sesi. Selain ini, /api/member & /api/admin wajib requireSession.
PUBLIC_PREFIXES = ("/api/auth/", "/api/public", "/api/realtime")

SECRET_PATTERNS = [
    (r"sk-(?:or-|ant-|proj-)?[A-Za-z0-9_-]{20,}", "API key gaya OpenAI/OpenRouter/Anthropic"),
    (r"\bre_[A-Za-z0-9]{16,}\b", "API key Resend"),
    (r"\bAKIA[0-9A-Z]{16}\b", "AWS access key"),
    (r"\bAIza[0-9A-Za-z_-]{35}\b", "Google API key"),
    (r"\bghp_[A-Za-z0-9]{30,}\b", "GitHub token"),
    (r"\bxox[baprs]-[A-Za-z0-9-]{10,}", "Slack token"),
    (r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----", "Private key"),
    (r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b", "Telegram bot token"),
]

SKIP_DIRS = {"node_modules", ".next", "out", ".git", "android", "ios", ".wrangler", "coverage"}
SKIP_FILES = {"package-lock.json"}


@dataclass
class Finding:
    check: str
    severity: str  # tinggi / sedang / info
    file: str
    line: int
    detail: str


def rel(path: str) -> str:
    return os.path.relpath(path, ROOT)


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


# ---------------------------------------------------------------- Worker ----

def split_functions(src: str) -> dict[str, tuple[int, str]]:
    """Peta nama handler -> (baris, isi fungsi). Deteksi kasar: sampai deklarasi top-level berikutnya."""
    out: dict[str, tuple[int, str]] = {}
    starts = [m for m in re.finditer(r"^(?:export\s+)?(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async)", src, re.M)]
    for i, m in enumerate(starts):
        name = m.group(1) or m.group(2)
        end = starts[i + 1].start() if i + 1 < len(starts) else len(src)
        out[name] = (line_of(src, m.start()), src[m.start():end])
    return out


def check_routes(src: str, findings: list[Finding]) -> list[dict]:
    funcs = split_functions(src)
    routes: list[dict] = []
    matches = list(re.finditer(r'url\.pathname(?:\s*===\s*|\.startsWith\()\s*"(/api/[^"]*)"', src))
    for i, m in enumerate(matches):
        path = m.group(1)
        # Blok route = dari kondisi ini sampai kondisi route berikutnya, supaya
        # handler route sebelah tidak ikut terbaca.
        block_end = matches[i + 1].start() if i + 1 < len(matches) else min(len(src), m.end() + 1500)
        block = src[m.end(): block_end]
        handlers = re.findall(r"return\s+(?:await\s+)?(handle\w+)\(", block)
        inline_guard = "requireSession(" in block
        if not handlers and not inline_guard:
            continue
        handler = handlers[0] if handlers else "(inline)"
        body = block + (funcs.get(handler, (0, ""))[1] if handlers else "")
        # requireSession di blok route atau di handler, atau lewat helper (requireAdmin, dll).
        guarded = "requireSession(" in body or bool(re.search(r"\brequire(?:Admin|Member|Auth)\w*\(", body))
        admin_checked = 'requireSession(env, request, "admin")' in body or "role !== \"admin\"" in body or "requireAdmin" in body
        routes.append({"path": path, "handler": handler, "line": line_of(src, m.start()), "session": guarded, "admin_role": admin_checked})
        if path.startswith(PUBLIC_PREFIXES):
            continue
        if path.startswith(("/api/member", "/api/admin")) and not guarded:
            findings.append(Finding("route-tanpa-sesi", "tinggi", rel(WORKER), line_of(src, m.start()),
                                    f"{path} -> {handler} tidak memanggil requireSession"))
        if path.startswith("/api/admin") and guarded and not admin_checked:
            findings.append(Finding("admin-tanpa-cek-role", "tinggi", rel(WORKER), line_of(src, m.start()),
                                    f"{path} -> {handler} memanggil requireSession tapi tidak terlihat cek role admin"))
    return routes


def iter_sql(src: str):
    """Isi string SQL yang dilewatkan ke .prepare(...) — template literal atau string biasa."""
    for m in re.finditer(r"\.prepare\(\s*(`(?:[^`\\]|\\.)*`|\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')", src, re.S):
        yield m.start(), m.group(1)


def check_sql(src: str, findings: list[Finding]) -> None:
    funcs = split_functions(src)
    func_starts = sorted((line, name) for name, (line, _) in funcs.items())

    def func_at(line: int) -> str:
        name = "?"
        for start, fname in func_starts:
            if start <= line:
                name = fname
            else:
                break
        return name

    for idx, sql in iter_sql(src):
        ln = line_of(src, idx)
        flat = " ".join(sql.split())
        if sql.startswith("`") and "${" in sql:
            exprs = re.findall(r"\$\{([^}]*)\}", sql)
            findings.append(Finding("sql-interpolasi", "sedang", rel(WORKER), ln,
                                    f"{func_at(ln)}: SQL memakai ${{{', '.join(e.strip() for e in exprs)}}} — pastikan hanya identifier dari whitelist, bukan input user"))
        ins = re.search(r"INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)", flat, re.I)
        if ins and "${" not in ins.group(2) + ins.group(3):
            cols = [c for c in ins.group(2).split(",") if c.strip()]
            vals = [v for v in ins.group(3).split(",") if v.strip()]
            if len(cols) != len(vals):
                findings.append(Finding("sql-jumlah-kolom", "tinggi", rel(WORKER), ln,
                                        f"{func_at(ln)}: INSERT {ins.group(1)} punya {len(cols)} kolom tapi {len(vals)} nilai — query ini selalu gagal"))
        verb = re.match(r"[`\"']\s*(SELECT|UPDATE|DELETE|INSERT)", flat, re.I)
        if not verb or verb.group(1).upper() == "INSERT":
            continue
        tables = [t for t in USER_TABLES if re.search(rf"\b(?:FROM|UPDATE|JOIN|INTO)\s+{t}\b", flat, re.I)]
        if tables and "user_id" not in flat:
            findings.append(Finding("sql-tanpa-user_id", "sedang", rel(WORKER), ln,
                                    f"{func_at(ln)}: {verb.group(1).upper()} {', '.join(tables)} tanpa user_id — wajar untuk cron/admin/lookup by token, BUG kalau id-nya dari request user"))


def check_error_leaks(src: str, path: str, findings: list[Finding]) -> None:
    patterns = [
        (r"json\(\s*\{[^}]*\berror\s*:\s*(?:String\(\s*(?:error|err|e)\s*\)|(?:error|err|e)\.message|`[^`]*\$\{(?:error|err|e)\b)", "error mentah dikirim ke client"),
        (r"json\(\s*\{[^}]*\bdebug\s*:", "field debug dalam response"),
        (r"\bstack\s*:\s*(?:error|err|e)\.stack", "stack trace dalam response"),
    ]
    for pat, why in patterns:
        for m in re.finditer(pat, src, re.S):
            findings.append(Finding("bocor-error", "sedang", rel(path), line_of(src, m.start()), why))


# -------------------------------------------------------------- repo-wide ----

def tracked_files() -> list[str]:
    res = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True)
    files = [os.path.join(ROOT, f) for f in res.stdout.splitlines()] if res.returncode == 0 else []
    if not files:
        for base, dirs, names in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            files += [os.path.join(base, n) for n in names]
    keep = []
    for f in files:
        parts = set(rel(f).split(os.sep))
        if parts & SKIP_DIRS or os.path.basename(f) in SKIP_FILES:
            continue
        keep.append(f)
    return keep


def check_secrets(files: list[str], findings: list[Finding]) -> None:
    for f in files:
        if not f.endswith((".ts", ".tsx", ".js", ".mjs", ".json", ".toml", ".env", ".md", ".sql", ".sh", ".yml", ".yaml", ".txt")) and ".env" not in f:
            continue
        try:
            text = open(f, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        for pat, why in SECRET_PATTERNS:
            for m in re.finditer(pat, text):
                findings.append(Finding("secret-hardcode", "tinggi", rel(f), line_of(text, m.start()), f"{why}: {m.group(0)[:8]}…"))
    toml = os.path.join(ROOT, "wrangler.toml")
    if os.path.exists(toml):
        text = open(toml, encoding="utf-8").read()
        vars_block = re.search(r"^\[vars\](.*?)(?=^\[|\Z)", text, re.M | re.S)
        if vars_block:
            for m in re.finditer(r"^\s*([A-Z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=", vars_block.group(1), re.M):
                findings.append(Finding("secret-di-vars", "tinggi", "wrangler.toml", line_of(text, vars_block.start(1) + m.start()),
                                        f"{m.group(1)} ada di [vars] (plaintext) — harusnya `wrangler secret put`"))


def check_frontend(files: list[str], findings: list[Finding]) -> None:
    patterns = [
        (r"dangerouslySetInnerHTML", "tinggi", "dangerouslySetInnerHTML — pastikan isinya disanitasi"),
        (r"\.innerHTML\s*=", "tinggi", "innerHTML di-assign — risiko XSS"),
        (r"\beval\(|new Function\(", "tinggi", "eval/new Function"),
        (r"(?:router\.(?:push|replace)|window\.location(?:\.href)?\s*=)\s*\(?\s*(?:params|searchParams|new URLSearchParams)[^;\n]*\.get\(", "sedang",
         "redirect ke nilai dari query string — cek whitelist (open redirect)"),
        (r"localStorage\.setItem\([^)]*(?:token|password|secret|session)", "sedang", "data sensitif di localStorage"),
    ]
    for f in files:
        if not f.startswith(os.path.join(ROOT, "src")) or not f.endswith((".ts", ".tsx")):
            continue
        text = open(f, encoding="utf-8", errors="ignore").read()
        lines = text.split("\n")
        for pat, sev, why in patterns:
            for m in re.finditer(pat, text, re.I):
                ln = line_of(text, m.start())
                # Lewati kemunculan di komentar (mis. "bukan eval()").
                if re.match(r"\s*(//|\*|/\*)", lines[ln - 1]):
                    continue
                findings.append(Finding("frontend", sev, rel(f), ln, why))


def main() -> int:
    as_json = "--json" in sys.argv
    findings: list[Finding] = []
    routes: list[dict] = []
    if os.path.exists(WORKER):
        src = open(WORKER, encoding="utf-8").read()
        routes = check_routes(src, findings)
        check_sql(src, findings)
        check_error_leaks(src, WORKER, findings)
    files = tracked_files()
    check_secrets(files, findings)
    check_frontend(files, findings)

    order = {"tinggi": 0, "sedang": 1, "info": 2}
    findings.sort(key=lambda f: (order.get(f.severity, 9), f.check, f.file, f.line))

    if as_json:
        print(json.dumps({"routes": routes, "findings": [asdict(f) for f in findings]}, indent=2, ensure_ascii=False))
        return 0

    member = [r for r in routes if r["path"].startswith(("/api/member", "/api/admin"))]
    print(f"Route API terdeteksi: {len(routes)} (member/admin: {len(member)}, tanpa sesi: {sum(1 for r in member if not r['session'])})")
    public = sorted({r["path"] for r in routes if not r["session"]})
    print("Endpoint TANPA requireSession (pastikan memang publik):")
    for p in public:
        print(f"  - {p}")
    print()
    if not findings:
        print("Tidak ada kandidat temuan.")
        return 0
    current = None
    for f in findings:
        key = (f.severity, f.check)
        if key != current:
            current = key
            count = sum(1 for x in findings if (x.severity, x.check) == key)
            print(f"\n[{f.severity.upper()}] {f.check} ({count})")
        print(f"  {f.file}:{f.line}  {f.detail}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
