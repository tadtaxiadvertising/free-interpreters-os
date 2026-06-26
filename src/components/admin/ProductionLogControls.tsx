"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, CalendarDays, Users } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";

const statusFilters = [
  { value: "all", label: "Todos" },
  { value: "Completed", label: "Completados" },
  { value: "Importado", label: "Importados" },
  { value: "PROCESSED", label: "Procesados" },
  { value: "OK", label: "OK" },
  { value: "Pending", label: "Pendientes" },
  { value: "Inactive", label: "Inactivos" },
];

export function ProductionLogControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [showInterpreterDropdown, setShowInterpreterDropdown] = useState(false);
  const filter = searchParams.get("filter") ?? "all";
  const fromDate = searchParams.get("fromDate") ?? "";
  const toDate = searchParams.get("toDate") ?? "";
  const interpreterId = searchParams.get("interpreterId") ?? "all";

  const [interpreters, setInterpreters] = useState<{ id: number; name: string }[]>([]);
  const [interpretersLoading, setInterpretersLoading] = useState(false);

  useEffect(() => {
    setInterpretersLoading(true);
    fetch("/api/v1/interpreters/select")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setInterpreters(data);
      })
      .catch(() => setInterpreters([]))
      .finally(() => setInterpretersLoading(false));
  }, []);

  const baseParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const updateUrl = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [pathname, router, startTransition]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(baseParams.toString());
      if (search.trim()) params.set("search", search.trim());
      else params.delete("search");
      updateUrl(params);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [baseParams, updateUrl, search]);

  function updateFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("filter");
    else params.set("filter", value);
    params.delete("page");
    updateUrl(params);
  }

  function updateFromDate(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("fromDate", value);
    else params.delete("fromDate");
    params.delete("page");
    updateUrl(params);
  }

  function updateToDate(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("toDate", value);
    else params.delete("toDate");
    params.delete("page");
    updateUrl(params);
  }

  function updateInterpreter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("interpreterId");
    else params.set("interpreterId", value);
    params.delete("page");
    updateUrl(params);
  }

  function clearAll() {
    setSearch("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  const hasAnyFilter = search || filter !== "all" || fromDate || toDate || interpreterId !== "all";

  return (
    <div className="space-y-4">
      {/* Row 1: Search + Status + Reset */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar intérprete, campaña, estado u observaciones..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-white outline-none transition focus:border-blue-400/70 focus:ring-2 focus:ring-blue-500/20"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-white" aria-label="Limpiar búsqueda">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal size={18} className="text-gray-500" />
          <select value={filter} onChange={(event) => updateFilter(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400/70">
            {statusFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          {hasAnyFilter && <button type="button" onClick={clearAll} className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white">Reset</button>}
          {isPending && <span className="text-xs text-blue-300">Actualizando...</span>}
        </div>
      </div>

      {/* Row 2: Date range + Interpreter + Show all interpreters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-gray-500" />
          <input
            type="date"
            value={fromDate}
            onChange={(event) => updateFromDate(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400/70"
            placeholder="From date"
          />
          <span className="text-gray-500 text-sm">→</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => updateToDate(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400/70"
            placeholder="To date"
          />
        </div>

        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-500" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowInterpreterDropdown(!showInterpreterDropdown)}
              className={cn(
                "rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-blue-400/70 min-w-[180px] text-left flex items-center justify-between",
                interpreterId !== "all" ? "text-blue-400" : "text-white"
              )}
            >
              <span>
                {interpreterId !== "all"
                  ? `${interpreters.find((i) => String(i.id) === interpreterId)?.name ?? `ID: ${interpreterId}`} — Historial completo`
                  : "Todos los intérpretes (resumen)"}
              </span>
              <span className="text-gray-500 ml-2">▾</span>
            </button>
            {showInterpreterDropdown && (
              <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] max-h-[300px] overflow-y-auto rounded-xl border border-white/10 bg-slate-950 shadow-2xl z-50">
                <button
                  type="button"
                  onClick={() => { updateInterpreter("all"); setShowInterpreterDropdown(false); }}
                  className={cn("w-full text-left px-4 py-2 text-sm hover:bg-white/10", interpreterId === "all" ? "text-blue-400" : "text-white")}
                >
                  Todos los intérpretes
                </button>
                <div className="border-t border-white/5" />
                {interpretersLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Cargando...</div>
                ) : (
                  interpreters.map((interp) => (
                    <button
                      key={interp.id}
                      type="button"
                      onClick={() => { updateInterpreter(String(interp.id)); setShowInterpreterDropdown(false); }}
                      className={cn("w-full text-left px-4 py-2 text-sm hover:bg-white/10", String(interp.id) === interpreterId ? "text-blue-400 font-semibold" : "text-white")}
                    >
                      {interp.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
