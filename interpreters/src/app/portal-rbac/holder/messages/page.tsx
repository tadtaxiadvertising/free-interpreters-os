"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { sendMessage, listHolderMessages, listAvailableInterpreters } from "@/app/actions/rbac-holder";
import toast from "react-hot-toast";

type Message = {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
  recipient: { id: string; name: string; role: string } | null;
};

type Interpreter = { id: string; name: string; email: string };

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  PENDING_ADMIN: { label: "Pendiente", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPROVED: { label: "Aprobado", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  REJECTED: { label: "Rechazado", class: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function HolderMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [interpreters, setInterpreters] = useState<Interpreter[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      listHolderMessages().then(data => setMessages(data as unknown as Message[])),
      listAvailableInterpreters().then(data => setInterpreters(data as unknown as Interpreter[])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleSend = (formData: FormData) => {
    startTransition(async () => {
      try {
        await sendMessage(Object.fromEntries(formData));
        toast.success("Mensaje enviado — pendiente de aprobación");
        loadData();
        // Reset form
        const form = document.getElementById("message-form") as HTMLFormElement;
        form?.reset();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Error al enviar";
        toast.error(errorMsg);
      }
    });
  };

  return (
    <RbacShell requiredRole="HOLDER">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Mensajería</h1>
        <p className="text-slate-400 mt-1">
          Los mensajes requieren aprobación del administrador antes de ser entregados
        </p>
      </div>

      {/* Compose Form */}
      <div className="rounded-2xl bg-white/5 border border-white/5 p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Nuevo Mensaje</h2>
        <form id="message-form" action={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Destinatario (opcional)
            </label>
            <select
              name="recipientId"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
            >
              <option value="">Mensaje general (Admin)</option>
              {interpreters.map((interp) => (
                <option key={interp.id} value={interp.id}>
                  {interp.name} — {interp.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Contenido del Mensaje *
            </label>
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Escriba su mensaje aquí..."
              maxLength={5000}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none"
            />
          </div>
          <button
            disabled={pending}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
          >
            {pending ? "Enviando..." : "📨 Enviar Mensaje"}
          </button>
        </form>
      </div>

      {/* Messages History */}
      <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Historial de Mensajes</h2>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No hay mensajes en el historial
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {messages.map((msg) => {
              const status = STATUS_MAP[msg.status] || STATUS_MAP.PENDING_ADMIN;
              const isMine = msg.author.role === "HOLDER";
              return (
                <div key={msg.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-white">{isMine ? 'Tú' : msg.author.name}</span>
                        {isMine && (
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.class}`}>
                            {status.label}
                          </span>
                        )}
                        {msg.recipient && isMine && (
                          <span className="text-xs text-slate-500">
                            → {msg.recipient.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300">{msg.content}</p>
                    </div>
                    <span className="text-xs text-slate-600 whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleDateString("es-DO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RbacShell>
  );
}
