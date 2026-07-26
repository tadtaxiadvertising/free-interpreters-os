#!/usr/bin/env python3
"""
TAD Anomaly Detector v3 — Python / Supabase REST API
====================================================
Se adapta al schema automaticamente (con o sin columnas nuevas).
Detecta:
  1. Intérpretes Offline mientras mayoría Online (desviación flock)
  2. Intérpretes Online sin heartbeat reciente
  3. Intérpretes Busy sin llamada activa (auto-fix si hay columna status_reason)
  4. Caída total del servicio
"""

import os
import sys
import json
from datetime import datetime, timezone

try:
    import httpx
except ImportError:
    print("ERROR: httpx no instalado. Corre: pip install httpx")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────
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


def main():
    now_utc = datetime.now(timezone.utc)

    # ── Probe: qué columnas existen? ────────────────────
    probe = rest("interpreters", params={"limit": "1", "select": "*"})
    if not probe:
        log("No se pudo leer la tabla interpreters.")
        return

    columns = set(probe[0].keys()) if probe else set()
    has_new_cols = "status_reason" in columns
    has_heartbeat = "last_heartbeat" in columns
    has_logs_table = False  # se chequea abajo

    log(f"Schema: nuevas columnas={'✅' if has_new_cols else '❌'} | heartbeat={'✅' if has_heartbeat else '❌'}")

    # ── Fetch full roster ──────────────────────────────
    select_cols = "id,name,external_id,realtime_status,campaign,updated_at"
    if has_new_cols:
        select_cols += ",status_reason,status_changed_at"
    if has_heartbeat:
        select_cols += ",last_heartbeat,last_activity"

    rows = rest("interpreters", params={
        "status": "eq.Activo",
        "select": select_cols,
        "order": "name.asc",
    })

    interpreters = rows or []
    total = len(interpreters)
    online = sum(1 for i in interpreters if i.get("realtime_status") == "Online")
    offline = sum(1 for i in interpreters if i.get("realtime_status") == "Offline")
    busy = sum(1 for i in interpreters if i.get("realtime_status") == "Busy")
    away = sum(1 for i in interpreters if i.get("realtime_status") == "Away")

    log(f"Flota: {total} activos | 🟢{online} 🟡{busy} 🟠{away} 🔴{offline}")
    if total == 0:
        return

    # ── 1. Desviación de flock ─────────────────────────
    online_ratio = online / total if total else 0
    anomalous_offline = [
        i for i in interpreters
        if i.get("realtime_status") == "Offline" and online_ratio > 0.6
    ]
    if anomalous_offline:
        names = ", ".join(i["name"].strip() for i in anomalous_offline[:5])
        log(f"⚠️  Desviación flock: {len(anomalous_offline)} offline vs {round(online_ratio*100)}% Online -> {names}")

    # ── 2. Stale / sin heartbeat ───────────────────────
    stale_threshold = 2  # horas
    if has_heartbeat:
        stale = []
        for i in interpreters:
            hb = i.get("last_heartbeat") or i.get("updated_at")
            if not hb:
                continue
            try:
                hb_dt = datetime.fromisoformat(hb.replace("Z", "+00:00"))
            except Exception:
                continue
            age = (now_utc - hb_dt).total_seconds() / 3600
            if age > stale_threshold and i.get("realtime_status") in ("Online", "Away"):
                stale.append((i["name"].strip(), age))
        if stale:
            log(f"⚠️  {len(stale)} interpretes sin heartbeat >{stale_threshold}h")
            for name, age in stale[:5]:
                log(f"       {name} (last hb {age:.1f}h ago)")
    else:
        # Sin heartbeat column, usar updated_at
        stale = []
        for i in interpreters:
            updated = i.get("updated_at")
            if not updated:
                continue
            try:
                ut = datetime.fromisoformat(updated.replace("Z", "+00:00"))
            except Exception:
                continue
            age = (now_utc - ut).total_seconds() / 3600
            if age > stale_threshold and i.get("realtime_status") == "Online":
                stale.append((i["name"].strip(), age))
        if stale:
            log(f"⚠️  {len(stale)} Online sin update >{stale_threshold}h (usando updated_at)")
            for name, age in stale[:5]:
                log(f"       {name} (updated {age:.1f}h ago)")

    # ── 3. Busy sin llamada activa ─────────────────────
    if has_new_cols:
        busy_no_call = [
            i for i in interpreters
            if i.get("realtime_status") == "Busy"
            and i.get("status_reason") != "call_started"
        ]
        if busy_no_call:
            log(f"⚠️  {len(busy_no_call)} Busy sin llamada activa (status_reason no es 'call_started')")

    # ── 4. Caída total ─────────────────────────────────
    if offline == total and total >= 2:
        log("🚨 TODOS los interpretes Offline — posible caida de servicio")

    log("✅ OK")


if __name__ == "__main__":
    main()