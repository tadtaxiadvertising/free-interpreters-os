"use client";
import Link from "next/link";

export default function ServiceSelection() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Free Interpreters OS</h1>
          <p className="text-slate-500 text-lg">Select the portal you wish to access</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Admin Portal */}
          <Link href="/portal-rbac/admin/login" className="group p-8 bg-white rounded-3xl shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all border border-slate-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Admin Portal</h2>
            <p className="text-slate-500 text-sm">System management and user provisioning</p>
          </Link>

          {/* Holder Portal */}
          <Link href="/portal-rbac/holder/login" className="group p-8 bg-white rounded-3xl shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all border border-slate-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Holder Vault</h2>
            <p className="text-slate-500 text-sm">Secure storage for platform credentials</p>
          </Link>

          {/* Interpreter Portal */}
          <Link href="/portal-rbac/interpreter/login" className="group p-8 bg-white rounded-3xl shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all border border-slate-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Interpreter</h2>
            <p className="text-slate-500 text-sm">Access your production dashboard and logs</p>
          </Link>
        </div>

        <div className="mt-12 text-center text-slate-400 text-sm">
          &copy; 2026 Free Interpreters OS &bull; Secure RBAC Infrastructure
        </div>
      </div>
    </div>
  );
}
