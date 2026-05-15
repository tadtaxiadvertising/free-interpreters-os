"use client";
import { useTransition } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";

export default function AdminLogin() {
  const [pending, startTransition] = useTransition();

  const handleAction = (formData: FormData) => {
    startTransition(async () => {
      const res = await signIn("credentials", { 
        ...Object.fromEntries(formData), 
        redirect: false 
      });

      if (res?.error) {
        toast.error("Invalid credentials");
      } else {
        window.location.href = "/portal-rbac/admin"; 
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form action={handleAction} className="max-w-sm w-full space-y-4 p-8 bg-white shadow-2xl rounded-2xl border border-red-50">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Admin Portal</h2>
          <p className="text-slate-500 text-sm mt-1">Authorized personnel only</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Email Address</label>
            <input name="email" type="email" required className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="admin@system.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Password</label>
            <input name="password" type="password" required className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="••••••••" />
          </div>
        </div>

        <button disabled={pending} className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 mt-4">
          {pending ? "Verifying..." : "Enter Secure Zone"}
        </button>
      </form>
    </div>
  );
}
