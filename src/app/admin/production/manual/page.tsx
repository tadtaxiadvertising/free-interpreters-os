"use client";

import { useState, useEffect, useMemo, useTransition, use } from "react";
import { createManualLog, getInterpretersForSelect } from "@/app/actions/manual-logs";
import { Clock, Calendar, CheckCircle2, AlertCircle, Search, Loader2, User } from "lucide-react";

export default function ManualLogPage(props: { params: Promise<any> }) {
  const params = use(props.params);
  
  const [interpreters, setInterpreters] = useState<{ id: number; name: string; externalId: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [interpreterId, setInterpreterId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const res = await getInterpretersForSelect();
      if (res.success && res.data) {
        setInterpreters(res.data);
      }
      setLoadingInitial(false);
    }
    load();
  }, []);

  const filteredInterpreters = useMemo(() => {
    if (!search) return interpreters.slice(0, 50); // limit to 50 when no search
    const lower = search.toLowerCase();
    return interpreters
      .filter((i) => i.name.toLowerCase().includes(lower) || i.externalId.toLowerCase().includes(lower))
      .slice(0, 50);
  }, [search, interpreters]);

  const selectedInterpreter = useMemo(() => {
    return interpreters.find((i) => i.id === interpreterId) || null;
  }, [interpreterId, interpreters]);

  const livePreviewMinutes = useMemo(() => {
    if (!date || !startTime || !endTime) return 0;
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    const diff = end.getTime() - start.getTime();
    if (diff <= 0 || isNaN(diff)) return 0;
    return Math.floor(diff / 60000);
  }, [date, startTime, endTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interpreterId || !date || !startTime || !endTime || livePreviewMinutes <= 0) {
      setMessage({ type: "error", text: "Por favor completa todos los campos correctamente." });
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const res = await createManualLog({ 
        interpreterId, 
        date, 
        startTime, 
        endTime, 
        totalMinutes: livePreviewMinutes 
      });
      
      if (res.success) {
        setMessage({ type: "success", text: "Registro manual creado exitosamente. Los minutos se han asignado a Nómina." });
        // Reset form
        setDate("");
        setStartTime("");
        setEndTime("");
        setInterpreterId(null);
        setSearch("");
      } else {
        setMessage({ type: "error", text: res.error || "Ocurrió un error inesperado." });
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Registro Manual de Tiempos</h1>
        <p className="text-slate-400 mt-2">
          Agrega horas interpretadas manualmente. Este registro se sincronizará automáticamente con el Payroll Engine.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6 bg-slate-900/50 border border-slate-800 p-6 rounded-xl shadow-lg">
          
          {/* Interpreter Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              Seleccionar Intérprete
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nombre o ID..."
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {loadingInitial ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando intérpretes...
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-lg bg-slate-950 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {filteredInterpreters.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400 text-center">No se encontraron resultados.</div>
                ) : (
                  filteredInterpreters.map((int) => (
                    <button
                      type="button"
                      key={int.id}
                      onClick={() => setInterpreterId(int.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors flex items-center justify-between border-b border-slate-800/50 last:border-0 ${
                        interpreterId === int.id ? "bg-slate-800 border-l-4 border-l-blue-500" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs bg-slate-800 text-blue-400 px-2 py-1 rounded-md">[{int.externalId}]</span>
                        <span className={`text-sm ${interpreterId === int.id ? "text-white font-medium" : "text-slate-300"}`}>{int.name}</span>
                      </div>
                      {interpreterId === int.id && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Fecha
            </label>
            <div className="relative">
              <input
                type="date"
                required
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all [&::-webkit-calendar-picker-indicator]:invert-[0.8]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Time */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Hora Inicio
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all [&::-webkit-calendar-picker-indicator]:invert-[0.8]"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Hora Fin
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all [&::-webkit-calendar-picker-indicator]:invert-[0.8]"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg flex items-start gap-3 mt-4 ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
              {message.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !interpreterId || livePreviewMinutes <= 0}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {isPending ? "Registrando..." : "Registrar Tiempo Manual"}
          </button>
        </form>

        {/* Live Preview Panel */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-lg sticky top-6">
            <h3 className="text-lg font-semibold text-white mb-6 border-b border-slate-800 pb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" /> Vista Previa
            </h3>
            
            <div className="space-y-5">
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Intérprete</span>
                <span className="text-slate-200 font-medium truncate">
                  {selectedInterpreter ? selectedInterpreter.name : "No seleccionado"}
                </span>
              </div>
              
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Fecha</span>
                <span className="text-slate-200 font-medium">{date || "--"}</span>
              </div>
              
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Horario</span>
                <span className="text-slate-200 font-medium">
                  {startTime || "--"} - {endTime || "--"}
                </span>
              </div>
              
              <div className="pt-4 mt-2 border-t border-slate-800">
                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold block mb-2">Total a Registrar</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-bold ${livePreviewMinutes > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                    {livePreviewMinutes}
                  </span>
                  <span className={`text-lg font-medium ${livePreviewMinutes > 0 ? "text-emerald-500/70" : "text-slate-600/70"}`}>
                    min
                  </span>
                </div>
              </div>
              
              {livePreviewMinutes > 0 && (
                <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg flex gap-3 items-start shadow-inner">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-100/90 leading-relaxed">
                    Se asignarán <strong className="text-emerald-400">{livePreviewMinutes} minutos</strong> a <span className="font-mono bg-emerald-950/50 px-1 py-0.5 rounded text-emerald-300">verifiedMinutes</span> para su procesamiento en nómina.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
