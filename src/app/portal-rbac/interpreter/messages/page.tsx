"use client";
import { useEffect, useState } from "react";
import RbacShell from "@/components/rbac-shell";
import { listInterpreterMessages } from "@/app/actions/rbac-interpreter";
import toast from "react-hot-toast";

type Message = {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string; role: string };
};

export default function InterpreterMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInterpreterMessages()
      .then(data => setMessages(data as any))
      .catch(() => toast.error("Error al cargar mensajes"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RbacShell requiredRole="INTERPRETER">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Comunicados</h1>
        <p className="text-slate-400 mt-1">Mensajes oficiales de tus titulares (verificados por administración)</p>
      </div>

      <div className="max-w-3xl">
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
            {messages.map((msg) => (
              <div key={msg.id} className="relative rounded-2xl bg-white/5 border border-white/5 p-6 hover:bg-white/[0.07] transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                    {msg.author.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">{msg.author.name}</span>
                    <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/10 uppercase tracking-tighter">
                      {msg.author.role === "HOLDER" ? "Titular" : "Admin"}
                    </span>
                  </div>
                  <span className="ml-auto text-[10px] text-slate-500">
                    {new Date(msg.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed pl-11">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </RbacShell>
  );
}
