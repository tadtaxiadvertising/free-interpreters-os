"use client";
import { useSession } from "next-auth/react";

export default function DebugAuthPage() {
  const { data: session, status } = useSession();

  return (
    <div className="p-10 bg-slate-900 text-white min-h-screen font-mono">
      <h1 className="text-2xl font-bold mb-4">RBAC Session Debug</h1>
      <pre className="bg-black/50 p-6 rounded-xl border border-white/10">
        {JSON.stringify({ status, session }, null, 2)}
      </pre>
    </div>
  );
}
