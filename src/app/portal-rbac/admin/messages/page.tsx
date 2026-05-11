"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { listPendingMessages, moderateMessage } from "@/app/actions/rbac-admin";
import toast from "react-hot-toast";

type Message = {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  author: { id: string; name: string; email: string; role: string };
  recipient: { id: string; name: string; email: string; role: string } | null;
};

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = () => {
    setLoading(true);
    listPendingMessages()
      .then(setMessages)
      .catch(() => toast.error("Error al cargar mensajes"))
      .finally(() => setLoading(false));
  };

  const handleModerate = (messageId: string, action: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      try {
        await moderateMessage({ messageId, action });
        toast.success(action === "APPROVED" ? "Mensaje aprobado" : "Mensaje rechazado");
        loadMessages();
      } catch (err: any) {
        toast.error(err.message || "Error de moderación");
      }
    });
  };

  return (
    <RbacShell requiredRole="ADMIN">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Moderación de Mensajes</h1>
        <p className="text-slate-400 mt-1">
          Los mensajes requieren aprobación antes de ser visibles para el destinatario
        </p>
      </div>

      {/* Pending Count Badge */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {messages.length} mensaje{messages.length !== 1 ? "s" : ""} pendiente{messages.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))
        ) : messages.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/5 p-12 text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-slate-400">No hay mensajes pendientes de moderación</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-2xl bg-white/5 border border-white/5 p-6 hover:border-amber-500/20 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Author Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">
                      {msg.author.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{msg.author.name}</p>
                      <p className="text-xs text-slate-500">{msg.author.email} · {msg.author.role}</p>
                    </div>
                    {msg.recipient && (
                      <>
                        <span className="text-slate-600 text-xs">→</span>
                        <span className="text-xs text-blue-400">{msg.recipient.name}</span>
                      </>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <p className="text-sm text-slate-300 leading-relaxed">{msg.content}</p>
                  </div>

                  <p className="text-xs text-slate-600 mt-2">
                    {new Date(msg.createdAt).toLocaleString("es-DO")}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleModerate(msg.id, "APPROVED")}
                    disabled={pending}
                    className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    onClick={() => handleModerate(msg.id, "REJECTED")}
                    disabled={pending}
                    className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    ✕ Rechazar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </RbacShell>
  );
}
