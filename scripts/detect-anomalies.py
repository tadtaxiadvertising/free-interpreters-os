#!/usr/bin/env python3
"""
TAD Anomaly Detector v4 — Basado en presencia REAL, no DB stale
===============================================================
Problema del v3: confiaba en `realtime_status` de la DB que podía
tener días de stale. Ahora usa `last_heartbeat` como fuente primaria:
  < 2min   → 🟢 Active (realmente en la página ahora)
  2-10min  → 🟡 Idle   (pestaña abierta, sin input)
  > 10min  → 🟠 Stale  (heartbeat caducado, probablemente offline)
  Offline  → 🔴 Offline (confirmado)
  no hb    → ❓ Unknown (nunca recibió heartbeat)
"""

import os
import sys
import json
from datetime import datetime, timezone
from hashlib import md5

try:
    import httpx
except ImportError:
    print("ERROR: httpx no instalado. Corre: pip install httpx")
    sys.exit(1)

# ── Config ──
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("⚠️  MODO MOCK: faltan env vars SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(0)

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# Umbrales de frescura (segundos)
ACTIVE_THRESHOLD = 120    # 2 min — realmente en la página
IDLE_THRESHOLD = 600       # 10 min — idle, posiblemente away


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def rest(url, method="GET", data=None, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{url.lstrip('/')}"
    with httpx.Client(timeout=20) as client:
        if method == "GET":
            r = client.get(url, headers=HEADERS, params=params)
        elif method == "PATCH":
            r = client.patch(url, headers=HEADERS, json=data, params=params)
        else:
            raise ValueError(f"Unsupported: {method}")
    if r.status_code >= 400:
        log(f"  ⚠️ API {r.status_code}: {r.text[:150]}")
        return None
    if r.text.strip() and r.status_code != 204:
        return r.json()
    return []


def classify(interpreter, now_utc):
    """Clasifica un intérprete según su estado REAL."""
    db_status = (interpreter.get("realtime_status") or "Offline").strip()
    hb_raw = interpreter.get("last_heartbeat")
    activity_raw = interpreter.get("last_activity")
    status_reason = interpreter.get("status_reason") or ""

    # 1. Si está offline en DB, confirmado
    if db_status == "Offline":
        return "offline"

    # 2. Si no tiene heartbeat NUNCA → unknown
    if not hb_raw and not activity_raw:
        return "unknown_no_data"

    # 3. Calcular edad del heartbeat (o activity como fallback)
    ts_raw = hb_raw or activity_raw
    try:
        ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
    except Exception:
        return "unknown_parse_error"

    age_seconds = (now_utc - ts).total_seconds()

    # 4. Clasificar por frescura
    if age_seconds < ACTIVE_THRESHOLD:
        return "active"      # 🟢 realmente en la página
    elif age_seconds < IDLE_THRESHOLD:
        return "idle"        # 🟡 pestaña abierta, sin input
    else:
        # 5. DB dice online pero heartbeat caducó → stale
        return "stale"       # 🟠 heartbeat caducado


def format_age(ts_raw, now_utc):
    if not ts_raw:
        return "—"
    try:
        ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
    except Exception:
        return "?"
    secs = (now_utc - ts).total_seconds()
    if secs < 60:
        return f"{int(secs)}s"
    if secs < 3600:
        return f"{int(secs // 60)}min"
    if secs < 86400:
        return f"{int(secs // 3600)}h"
    return f"{int(secs // 86400)}d"


def main():
    now_utc = datetime.now(timezone.utc)

    # ── Probe: columnas ──────────────────────────
    probe = rest("interpreters", params={"limit": "1", "select": "*"})
    if not probe:
        log("No se pudo leer la tabla interpreters.")
        return

    columns = set(probe[0].keys()) if probe else set()
    has_heartbeat = "last_heartbeat" in columns
    has_new_cols = "status_reason" in columns

    log(f"Schema: heartbeat={'✅' if has_heartbeat else '❌'} | nuevas columnas={'✅' if has_new_cols else '❌'}")

    # ── Fetch roster ────────────────────────────
    select_cols = "id,name,external_id,realtime_status,campaign,updated_at"
    if has_new_cols:
        select_cols += ",status_reason,status_changed_at"
    if has_heartbeat:
        select_cols += ",last_heartbeat,last_activity,last_online_at,last_offline_at"

    rows = rest("interpreters", params={
        "status": "eq.Activo",
        "select": select_cols,
        "order": "name.asc",
    })

    interpreters = rows or []
    total = len(interpreters)
    log(f"Total activos en DB: {total}")

    if total == 0:
        return

    # ── Clasificar cada intérprete ────────────────
    classified = {"active": [], "idle": [], "stale": [], "offline": [], "unknown_no_data": [],
                   "unknown_parse_error": []}
    details = []

    for i in interpreters:
        cat = classify(i, now_utc)
        classified[cat].append(i)

        hb_raw = i.get("last_heartbeat") or i.get("last_activity")
        age = format_age(hb_raw, now_utc)
        extra = ""
        if cat == "stale":
            extra = f" (DB={i.get('realtime_status')}, hb={age})"
        elif cat == "unknown_no_data":
            extra = " (nunca envió heartbeat)"
        details.append(f"  {i['name'].strip():20s} {cat:12s} {extra}")

    # ── Reporte ──────────────────────────────────
    n_active = len(classified["active"])
    n_idle = len(classified["idle"])
    n_stale = len(classified["stale"])
    n_offline = len(classified["offline"])
    n_unknown = len(classified["unknown_no_data"]) + len(classified["unknown_parse_error"])

    log(f"  🟢 Active  (hb<2min):   {n_active}")
    log(f"  🟡 Idle    (hb 2-10min): {n_idle}")
    log(f"  🟠 Stale   (hb>10min):   {n_stale}")
    log(f"  🔴 Offline (DB):         {n_offline}")
    log(f"  ❓ Unknown (sin hb):     {n_unknown}")

    # ── Detalle por categoría ────────────────────
    if n_active:
        log(f"\n🟢 REALMENTE activos ahora:")
        for i in classified["active"]:
            hb = i.get("last_heartbeat") or i.get("last_activity")
            log(f"     {i['name'].strip():20s} hb={format_age(hb, now_utc)} ago")
    if n_idle:
        log(f"\n🟡 Idle (posiblemente away):")
        for i in classified["idle"]:
            hb = i.get("last_heartbeat") or i.get("last_activity")
            log(f"     {i['name'].strip():20s} hb={format_age(hb, now_utc)} ago")
    if n_stale:
        log(f"\n⚠️  STALE — DB dice Online pero heartbeat caducó:")
        for i in classified["stale"]:
            hb_raw = i.get("last_heartbeat") or i.get("last_activity")
            status = i.get("realtime_status", "")
            log(f"     {i['name'].strip():20s} status={status:8s} último={format_age(hb_raw, now_utc)} ago")
    if classified["unknown_no_data"]:
        log(f"\n⚠️  STATUS SOSPECHOSO (sin heartbeat nunca):")
        for i in classified["unknown_no_data"]:
            log(f"     {i['name'].strip():20s} DB={i.get('realtime_status')}")

    # ── Alertas ──────────────────────────────────
    alertas = []

    # Stale masivo
    if n_stale >= 3:
        alertas.append(f"🚨 {n_stale} interpretes con heartbeat caducado — posible caida de servicio")

    # Stale individuales
    for i in classified["stale"]:
        hb_raw = i.get("last_heartbeat") or i.get("last_activity")
        alertas.append(f"⚠️  {i['name'].strip()} marcado Online en DB pero heartbeat caducó ({format_age(hb_raw, now_utc)} ago)")

    # Sin heartbeat nunca
    for i in classified["unknown_no_data"]:
        alertas.append(f"⚠️  {i['name'].strip()} tiene status={i.get('realtime_status')} pero NUNCA envió heartbeat")

    # Flock real — basado en active real, no DB
    real_online = n_active + n_idle
    if real_online == 0 and n_offline == 0:
        alertas.append("⚠️  NADIE activo en tiempo real — todos los status son stale")
    elif real_online == 0 and n_offline == total:
        pass  # todo bien, todos fuera
    elif real_online == 0:
        alertas.append(f"⚠️  0 usuarios activos de {total} — posible desconexion general")

    # Caída total
    if n_offline + n_stale + n_unknown == total and total >= 2:
        alertas.append("🚨 TODOS offline o stale — posible caida de servicio")

    # ── State tracking (evitar spam si no hay cambios) ──
    STATE_FILE = "/opt/data/.anomaly_state.json"
    alert_hash = md5(json.dumps(alertas, sort_keys=True).encode()).hexdigest()[:8]
    last_state = {}
    try:
        with open(STATE_FILE) as f:
            last_state = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    has_changed = alert_hash != last_state.get("alert_hash")
    alert_count_changed = len(alertas) != last_state.get("alert_count", 0)
    should_report = has_changed or alert_count_changed

    # Guardar estado actual
    with open(STATE_FILE, "w") as f:
        json.dump({
            "alert_hash": alert_hash,
            "alert_count": len(alertas),
            "n_active": n_active,
            "n_idle": n_idle,
            "n_stale": n_stale,
            "n_offline": n_offline,
            "n_unknown": n_unknown,
            "last_check": now_utc.isoformat(),
        }, f)

    # ── Salida final ─────────────────────────────
    resumen = f"🟢{n_active} 🟡{n_idle} 🟠{n_stale} 🔴{n_offline} ❓{n_unknown}"

    if alertas and should_report:
        log("")
        for a in alertas:
            log(a)
        log("")
        log(f"✅ Resumen: {resumen}")
    elif alertas and not should_report:
        # Sin cambios — solo resumen compacto
        log(f"⏱️  Sin cambios desde ultimo chequeo — {resumen}")
    else:
        log(f"✅ {resumen}")


if __name__ == "__main__":
    main()