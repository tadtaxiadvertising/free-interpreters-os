"use client";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";

export default function Login() {
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
        // Redirection based on role logic could be handled here or inside NextAuth callbacks
        // For simplicity, we assume they go to their respective dashboard
        window.location.href = "/portal-rbac/holder"; 
      }
    });
  };

  return (
    <form action={handleAction} className="max-w-sm mx-auto mt-32 space-y-4 p-6 bg-white shadow-xl rounded-xl border border-slate-100">
      <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Portal Access</h2>
      <input name="email" type="email" required className="w-full border p-2.5 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Email" />
      <input name="password" type="password" required className="w-full border p-2.5 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Password" />
      <button disabled={pending} className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
        {pending ? "Authenticating..." : "Sign In"}
      </button>
    </form>
  );
}
