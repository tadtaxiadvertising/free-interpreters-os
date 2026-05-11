"use client";
import { useTransition } from "react";
import { createHolder } from "@/app/actions/rbac-admin";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [pending, startTransition] = useTransition();

  const handleAction = (formData: FormData) => {
    startTransition(async () => {
      try {
        await createHolder(Object.fromEntries(formData) as any);
        toast.success("Holder successfully provisioned");
      } catch (err: any) {
        toast.error(err.message || "Failed to create holder");
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Admin Control Center</h1>
      <form action={handleAction} className="space-y-4">
        <input name="name" required placeholder="Holder Name" className="w-full border p-2.5 rounded-md" />
        <input name="email" type="email" required placeholder="Email Address" className="w-full border p-2.5 rounded-md" />
        <input name="password" type="password" required placeholder="Secure Password" className="w-full border p-2.5 rounded-md" />
        <button disabled={pending} className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-md font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
          {pending ? "Creating..." : "Create Holder Entity"}
        </button>
      </form>
    </div>
  );
}
