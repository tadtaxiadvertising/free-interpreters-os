"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

const filters = [
  { value: "all", label: "Todos" },
  { value: "Completed", label: "Completados" },
  { value: "Pending", label: "Pendientes" },
  { value: "Inactive", label: "Inactivos" },
];

export function ProductionLogControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const filter = searchParams.get("filter") ?? "all";

  const baseParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(baseParams.toString());
      if (search.trim()) params.set("search", search.trim());
      else params.delete("search");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [baseParams, pathname, router, search]);

  function updateFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("filter");
    else params.set("filter", value);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function clearAll() {
    setSearch("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative min-w-[260px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar intérprete, campaña o estado..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-white outline-none transition focus:border-blue-400/70 focus:ring-2 focus:ring-blue-500/20"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-white" aria-label="Limpiar búsqueda">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={18} className="text-gray-500" />
        <select value={filter} onChange={(event) => updateFilter(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400/70">
          {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {(search || filter !== "all") && <button type="button" onClick={clearAll} className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white">Reset</button>}
        {isPending && <span className="text-xs text-blue-300">Actualizando...</span>}
      </div>
    </div>
  );
}
