"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { listInterpreterMessages, sendMessageAsInterpreter } from "@/app/actions/rbac-interpreter";
import toast from "react-hot-toast";

type Message = {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  author: { name: string; role: string };
  recipient: { name: string; role: string } | null;
};

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  PENDING_ADMIN: { label: "En Revisión", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPROVED: { label: "Aprobado", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  REJECTED: { label: "Rechazado", class: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function InterpreterMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = () => {
    setLoading(true);
    listInterpreterMessages()
      .then(data => setMessages(data as unknown as Message[]))
      .catch(() => toast.error("Error al cargar mensajes"))
      .finally(() => setLoading(false));
  };

  return (
    <RbacShell requiredRole="INTERPRETER">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Comunicados</h1>
        <p className="text-slate-400 mt-1">Mensajes oficiales de la administración. Puedes responder y tus mensajes serán moderados.</p>
      </div>

      <div className="max-w-3xl">
        {/* Compose Form */}
        <div className="rounded-2xl bg-white/5 border border-white/5 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Contactar Administración</h2>
          <form
            id="interpreter-message-form"
            action={(formData) => {
              startTransition(async () => {
                try {
                  await sendMessageAsInterpreter(Object.fromEntries(formData));
                  toast.success("Mensaje enviado (Pendiente de revisión)");
                  (document.getElementById("interpreter-message-form") as HTMLFormElement)?.reset();
                  loadMessages();
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Error al enviar");
                }
              });
            }}
            className="space-y-4"
          >
            <div>
              <textarea
                name="content"
                required
                rows={3}
                placeholder="Escriba su mensaje para el administrador..."
                maxLength={5000}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
              />
            </div>
            <button
              disabled={pending}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
            >
              {pending ? "Enviando..." : "📨 Enviar Mensaje"}
            </button>
          </form>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Historial de Conversación</h2>
        </div>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-3xl bg-white/5 border border-white/5 p-12 text-center">
            <p className="text-slate-500">No tienes mensajes nuevos en este momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const status = STATUS_MAP[msg.status] || STATUS_MAP.PENDING_ADMIN;
              const isMine = msg.author.role === "INTERPRETER";
              
              return (
                <div key={msg.id} className="relative rounded-2xl bg-white/5 border border-white/5 p-6 hover:bg-white/[0.07] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full ${isMine ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center text-xs font-bold`}>
                      {msg.author.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white">{isMine ? 'Tú' : msg.author.name}</span>
                      <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 uppercase tracking-tighter">
                        {msg.author.role}
                      </span>
                    </div>
                    {isMine && (
                      <span className={`ml-3 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.class}`}>
                        {status.label}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-500">
                      {new Date(msg.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed pl-11">
                    {msg.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RbacShell>
  );
}
