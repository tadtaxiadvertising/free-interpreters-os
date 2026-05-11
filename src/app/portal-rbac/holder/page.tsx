"use client";
import { useTransition } from "react";
import { uploadAccount } from "@/app/actions/rbac-holder";
import toast from "react-hot-toast";

export default function HolderDashboard() {
  const [pending, startTransition] = useTransition();

  const handleVault = (formData: FormData) => {
    startTransition(async () => {
      try {
        await uploadAccount(Object.fromEntries(formData) as any);
        toast.success("Account synced to Data Vault");
      } catch (err: any) {
        toast.error(err.message || "Vault sync failed");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
        <h1 className="text-xl font-bold mb-6 text-slate-800">Data Vault Integration</h1>
        <form action={handleVault} className="space-y-4">
          <input name="platformName" required placeholder="Platform (e.g., Zoom, Webex)" className="w-full border p-2.5 rounded-md" />
          <input name="credentials" type="password" required placeholder="Access Credentials" className="w-full border p-2.5 rounded-md" />
          <button disabled={pending} className="w-full bg-amber-500 text-white px-4 py-2.5 rounded-md font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">
            {pending ? "Encrypting..." : "Secure in Vault"}
          </button>
        </form>
      </div>
    </div>
  );
}
