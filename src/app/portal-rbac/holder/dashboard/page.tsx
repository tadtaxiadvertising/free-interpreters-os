import React from "react";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-rbac";
import { createVaultAccount } from "@/app/actions/vault.actions";

export default async function HolderDashboard() {
  const session = await requireRole("HOLDER", "ADMIN");

  const accounts = await (prisma as any).vaultAccount.findMany({
    where: { holderId: session.user.id },
    include: { interpreter: true },
  });

  const interpreters = await (prisma as any).rbacUser.findMany({
    where: { role: "INTERPRETER" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center pb-4 border-b">
        <h1 className="text-3xl font-bold">Holder Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome, {session.user.name}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="col-span-1 bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Create New Account</h2>
          <form action={async (formData) => { "use server"; await createVaultAccount(formData); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Platform Name</label>
              <input name="platformName" required className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL (optional)</label>
              <input name="url" type="url" className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">VPN Config (optional)</label>
              <input name="vpnConfig" className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Credentials (Username/Password)</label>
              <textarea name="credentials" required className="w-full border rounded p-2 h-24" placeholder="Enter credentials to encrypt..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Assign Interpreter</label>
              <select name="interpreterId" className="w-full border rounded p-2">
                <option value="">-- Unassigned --</option>
                {interpreters.map((int: any) => (
                  <option key={int.id} value={int.id}>
                    {int.name} ({int.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea name="notes" className="w-full border rounded p-2" />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700">
              Save Encrypted Account
            </button>
          </form>
        </section>

        <section className="col-span-1 lg:col-span-2 bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Managed Accounts</h2>
          {accounts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No accounts created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3">Platform</th>
                    <th className="p-3">Assigned Interpreter</th>
                    <th className="p-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc: any) => (
                    <tr key={acc.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{acc.platformName}</div>
                        {acc.url && <a href={acc.url} className="text-xs text-blue-500 hover:underline">{acc.url}</a>}
                      </td>
                      <td className="p-3">
                        {acc.interpreter ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            {acc.interpreter.name}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-500">
                        {new Date(acc.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
