"use client";

import { useState, useEffect, useMemo, useTransition, use } from "react";
import { createManualLog, getInterpretersForSelect } from "@/app/actions/manual-logs";
import { Clock, Calendar, CheckCircle2, AlertCircle, Search, Loader2, User } from "lucide-react";

// In Next.js 15+ & React 19, params in dynamic routes should be awaited. 
// Since this is a static route, we can just define the type if there were any params.
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
    if (!interpreterId || !date || !startTime || !endTime) {
      setMessage({ type: "error", text: "Por favor completa todos los campos." });
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const res = await createManualLog({ interpreterId, date, startTime, endTime });
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
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Registro Manual de Tiempos</h1>
        <p className="text-muted-foreground mt-2">
          Agrega horas interpretadas manualmente. Este registro se sincronizará automáticamente con el Payroll Engine.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="md:col-span-2 space-y-6 bg-card border border-border p-6 rounded-xl shadow-sm">
          
          {/* Interpreter Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Seleccionar Intérprete
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre o ID..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {loadingInitial ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando intérpretes...
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-background">
                {filteredInterpreters.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No se encontraron resultados.</div>
                ) : (
                  filteredInterpreters.map((int) => (
                    <button
                      type="button"
                      key={int.id}
                      onClick={() => setInterpreterId(int.id)}
                      className={`w-full text-left px-4 py-2 hover:bg-primary/10 transition-colors text-sm ${
                        interpreterId === int.id ? "bg-primary/20 border-l-2 border-primary text-white font-medium" : "text-gray-300"
                      }`}
                    >
                      <span className="font-mono text-xs text-primary mr-2">[{int.externalId}]</span>
                      {int.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Fecha
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Hora Inicio
              </label>
              <input
                type="time"
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Hora Fin
              </label>
              <input
                type="time"
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-md flex items-start gap-3 ${message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-500" : "bg-red-500/10 border border-red-500/20 text-red-500"}`}>
              {message.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !interpreterId}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {isPending ? "Registrando..." : "Registrar Tiempo Manual"}
          </button>
        </form>

        {/* Live Preview Panel */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm sticky top-6">
            <h3 className="text-lg font-semibold text-white mb-4">Vista Previa</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground text-sm">Intérprete</span>
                <span className="text-white font-medium text-right max-w-[150px] truncate">
                  {selectedInterpreter ? selectedInterpreter.name : "No seleccionado"}
                </span>
              </div>
              
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground text-sm">Fecha</span>
                <span className="text-white font-medium">{date || "--"}</span>
              </div>
              
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground text-sm">Horario</span>
                <span className="text-white font-medium">
                  {startTime || "--"} - {endTime || "--"}
                </span>
              </div>
              
              <div className="pt-2">
                <span className="text-muted-foreground text-sm block mb-2">Total a Registrar</span>
                <div className="text-4xl font-bold text-primary flex items-end gap-2">
                  {livePreviewMinutes} <span className="text-lg font-normal text-muted-foreground mb-1">min</span>
                </div>
              </div>
              
              {livePreviewMinutes > 0 && (
                <div className="mt-4 bg-primary/10 border border-primary/20 p-3 rounded-lg flex gap-2">
                  <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-primary/90">
                    Se asignarán {livePreviewMinutes} minutos a <span className="font-mono">verifiedMinutes</span> para su procesamiento en nómina.
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
