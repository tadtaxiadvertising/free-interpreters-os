import React from "react";
import { getRbacEarningsData } from "@/app/actions/rbac-data";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  Download,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InterpreterEarningsPage() {
  const interpreter = await getRbacEarningsData();

  if (!interpreter) {
    return (
      <div className="p-12 glass rounded-3xl border border-white/5 text-center">
        <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
        <h3 className="text-xl font-bold text-white">Perfil no vinculado</h3>
        <p className="text-gray-400 mt-2">
          Tu cuenta RBAC no está vinculada a un perfil de intérprete. Contacta
          al administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <DollarSign className="text-green-400" />
          Earnings &amp; Payments
        </h2>
        <p className="text-gray-400 mt-2">
          Track your income, rates, and payment history.
        </p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-green-500/5 to-transparent">
          <p className="text-sm text-gray-500 font-medium">Your Base Rate</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">
              RD${(Number(interpreter.tariffPerMinute) * 60).toFixed(2)}
            </h3>
            <span className="text-xs text-gray-400">per interpreted hour</span>
          </div>
          <TrendingUp size={24} className="mt-4 text-green-500" />
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Last Payment</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">
              {interpreter.payrollRecords[0]
                ? `RD$${interpreter.payrollRecords[0].netTotal.toString()}`
                : "RD$0.00"}
            </h3>
          </div>
          <Calendar size={24} className="mt-4 text-blue-400" />
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Preferred Method</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-xl font-bold text-white">
              {interpreter.metodoPago || "Not Set"}
            </h3>
          </div>
          <div className="mt-4 text-xs text-gray-500 truncate">
            {interpreter.cuentaPago ||
              "Add your payment details in Settings"}
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-xl font-bold text-white">Payment History</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                <th className="p-6">Period</th>
                <th className="p-6">Hours</th>
                <th className="p-6">Gross</th>
                <th className="p-6">Bonus/Deductions</th>
                <th className="p-6">Net Total</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {interpreter.payrollRecords.map((record: any) => (
                <tr
                  key={record.id}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="p-6">
                    <div className="text-white font-medium">
                      {new Date(record.periodStart).toLocaleDateString()} -{" "}
                      {new Date(record.periodEnd).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-6 text-gray-400">
                    {(record.totalMinutes / 60).toFixed(2)}h
                  </td>
                  <td className="p-6 text-gray-400">
                    RD${record.grossTotal.toString()}
                  </td>
                  <td className="p-6">
                    <span className="text-green-400 text-xs">
                      +RD${(record.qualityBonus || 0).toString()}
                    </span>
                    <span className="text-red-400 text-xs ml-2">
                      -RD${(record.penalidades || 0).toString()}
                    </span>
                  </td>
                  <td className="p-6 text-white font-bold">
                    RD${record.netTotal.toString()}
                  </td>
                  <td className="p-6">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        record.status === "Pagado"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <button className="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all">
                      <Download size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {interpreter.payrollRecords.length === 0 && (
            <div className="p-20 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p>No payment records found yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
