import React from "react";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-rbac";
import { decryptPassword } from "@/lib/vault-crypto";

export default async function InterpreterDashboard() {
  const session = await requireRole("INTERPRETER", "ADMIN");

  const accounts = await prisma.vaultAccount.findMany({
    where: { interpreterId: session.user.id },
    include: { holder: { select: { name: true, email: true } } },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex justify-between items-center pb-4 border-b">
        <h1 className="text-3xl font-bold">Interpreter Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome, {session.user.name}</p>
      </header>

      <section className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-xl font-semibold mb-4">Assigned Accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No accounts have been assigned to you yet.</p>
        ) : (
          <div className="grid gap-6">
            {accounts.map((acc) => {
              let decryptedCredentials = "Error decrypting";
              try {
                decryptedCredentials = decryptPassword(acc.credentials);
              } catch {
                console.error("Failed to decrypt credentials for account", acc.id);
              }

              return (
                <div key={acc.id} className="border rounded-lg p-5 flex flex-col gap-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{acc.platformName}</h3>
                      {acc.url && (
                        <a href={acc.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                          {acc.url}
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      Holder: {acc.holder.name}
                    </span>
                  </div>

                  <div className="mt-2">
                    <p className="text-sm font-semibold text-gray-700">Credentials:</p>
                    <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto mt-1">
                      {decryptedCredentials}
                    </pre>
                  </div>

                  {acc.vpnConfig && (
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-gray-700">VPN Config:</p>
                      <p className="text-sm text-gray-600 bg-white border p-2 rounded mt-1">{acc.vpnConfig}</p>
                    </div>
                  )}

                  {acc.notes && (
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-gray-700">Notes:</p>
                      <p className="text-sm text-gray-600 bg-yellow-50 border p-2 rounded mt-1">{acc.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
