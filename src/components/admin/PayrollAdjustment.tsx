'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  AlertTriangle,
  Settings,
  ChevronDown,
  ChevronUp,
  Save,
  Plus,
  Trash2,
  BadgeCheck,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface PayrollRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  interpreterId: number;
  totalMinutes: number;
  verifiedMinutes: number | null;
  grossTotal: string;
  qualityBonus: string;
  incentivesTotal: string;
  penalidades: string;
  transferDeduction: string;
  netTotal: string;
  status: string;
  paymentDate: string | null;
  paidAt: string | null;
  interpreter: {
    name: string;
    externalId: string;
    metodoPago: string | null;
  };
}

interface IncentiveTier {
  tierNumber: number;
  hours: number;
  bonus: number;
}

// ────────────────────────────────────────────────────────────
// Status badge
// ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PAID: 'bg-green-500/10 text-green-300 border-green-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    // Fallbacks for older records
    Pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Verificado: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Pagado: 'bg-green-500/10 text-green-300 border-green-500/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
        styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      }`}
    >
      {(status === 'PAID' || status === 'Pagado') && <BadgeCheck size={12} />}
      {status}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function PayrollAdjustment() {
  // ── State: Payroll Records ──
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // recordId being acted on
  const [verifyInputs, setVerifyInputs] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>('');

  // ── State: Incentives Config ──
  const [showIncentives, setShowIncentives] = useState(false);
  const [tiers, setTiers] = useState<IncentiveTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tiersSaving, setTiersSaving] = useState(false);
  const [tiersError, setTiersError] = useState<string | null>(null);
  const [tiersSuccess, setTiersSuccess] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────
  // Fetch payroll records
  // ────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filterStatus
        ? `/api/payroll?status=${encodeURIComponent(filterStatus)}`
        : '/api/payroll';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecords(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payroll records');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ────────────────────────────────────────────────────────────
  // Fetch incentive tiers
  // ────────────────────────────────────────────────────────────
  const fetchTiers = useCallback(async () => {
    setTiersLoading(true);
    setTiersError(null);
    try {
      const res = await fetch('/api/config/incentives');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Convert tiers object to array
      const tierArray: IncentiveTier[] = [];
      if (data.tiers) {
        for (const [key, value] of Object.entries(data.tiers) as [string, any][]) {
          const num = parseInt(key.replace('tier', ''), 10);
          tierArray.push({
            tierNumber: num,
            hours: parseInt(value.hours || '0', 10),
            bonus: parseFloat(value.bonus || '0'),
          });
        }
      }
      tierArray.sort((a, b) => a.tierNumber - b.tierNumber);

      // If no tiers exist, add a starter template
      if (tierArray.length === 0) {
        tierArray.push(
          { tierNumber: 1, hours: 100, bonus: 50 },
          { tierNumber: 2, hours: 150, bonus: 100 },
          { tierNumber: 3, hours: 200, bonus: 200 }
        );
      }

      setTiers(tierArray);
    } catch (err: any) {
      setTiersError(err.message || 'Failed to fetch incentive tiers');
    } finally {
      setTiersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showIncentives) fetchTiers();
  }, [showIncentives, fetchTiers]);

  // ────────────────────────────────────────────────────────────
  // Verify action (overwrite minutes)
  // ────────────────────────────────────────────────────────────
  const handleVerify = async (recordId: string) => {
    const minutesStr = verifyInputs[recordId];
    if (!minutesStr || isNaN(parseInt(minutesStr, 10))) {
      alert('Please enter a valid number of verified minutes.');
      return;
    }

    setActionLoading(recordId);
    try {
      const res = await fetch('/api/payroll/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollRecordId: recordId,
          action: 'verify',
          verifiedMinutes: parseInt(minutesStr, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      await fetchRecords();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Mark as Paid
  // ────────────────────────────────────────────────────────────
  const handleMarkPaid = async (recordId: string) => {
    const transactionReference = prompt('Ingrese la referencia de la transacción (Ej: Banco Popular #12345):');
    if (!transactionReference) return;

    setActionLoading(recordId);
    try {
      const res = await fetch('/api/payroll/pay', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollRecordId: recordId,
          transactionReference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as paid');
      await fetchRecords();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Save incentive tiers
  // ────────────────────────────────────────────────────────────
  const handleSaveTiers = async () => {
    setTiersSaving(true);
    setTiersError(null);
    setTiersSuccess(null);
    try {
      const res = await fetch('/api/config/incentives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save tiers');
      setTiersSuccess(data.message || 'Saved successfully');
      setTimeout(() => setTiersSuccess(null), 4000);
    } catch (err: any) {
      setTiersError(err.message);
    } finally {
      setTiersSaving(false);
    }
  };

  const addTier = () => {
    const maxNum = tiers.length > 0 ? Math.max(...tiers.map((t) => t.tierNumber)) : 0;
    setTiers([...tiers, { tierNumber: maxNum + 1, hours: 0, bonus: 0 }]);
  };

  const removeTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const updateTier = (idx: number, field: 'hours' | 'bonus', val: string) => {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: parseFloat(val) || 0 };
    setTiers(updated);
  };

  // ────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────
  const fmt = (val: string | number) =>
    parseFloat(String(val)).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const minutesToHM = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}h ${min}m`;
  };

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Payroll Verification & Incentives
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Verify interpreted hours, manage incentive tiers, and process payments.
          </p>
        </div>

        <button
          onClick={() => setShowIncentives(!showIncentives)}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all border border-white/10"
        >
          <Settings size={16} />
          Incentive Config
          {showIncentives ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Incentive Tiers Config Panel ── */}
      {showIncentives && (
        <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-6 space-y-5 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Incentive Tiers</h3>
            <button
              onClick={addTier}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={14} />
              Add Tier
            </button>
          </div>

          {tiersLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="animate-spin mr-2" size={18} />
              Loading tiers…
            </div>
          ) : (
            <div className="space-y-3">
              {tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 items-center bg-white/[0.03] rounded-2xl px-5 py-3 border border-white/5"
                >
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                    Tier {tier.tierNumber}
                  </span>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                      Min. Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tier.hours}
                      onChange={(e) => updateTier(idx, 'hours', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:border-blue-500/50 transition-colors outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                      Bonus (USD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tier.bonus}
                      onChange={(e) => updateTier(idx, 'bonus', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:border-blue-500/50 transition-colors outline-none"
                    />
                  </div>
                  <button
                    onClick={() => removeTier(idx)}
                    className="p-2 hover:bg-red-500/10 rounded-xl text-gray-600 hover:text-red-400 transition-colors"
                    title="Remove tier"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tiersError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertTriangle size={14} />
              {tiersError}
            </div>
          )}

          {tiersSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
              <CheckCircle size={14} />
              {tiersSuccess}
            </div>
          )}

          <button
            onClick={handleSaveTiers}
            disabled={tiersSaving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(37,99,235,0.2)]"
          >
            {tiersSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Incentive Tiers
          </button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-900/80 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:border-blue-500/50 transition-colors outline-none appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-900 text-white">All Statuses</option>
          <option value="PENDING" className="bg-slate-900 text-white">PENDING</option>
          <option value="APPROVED" className="bg-slate-900 text-white">APPROVED</option>
          <option value="PAID" className="bg-slate-900 text-white">PAID</option>
          <option value="REJECTED" className="bg-slate-900 text-white">REJECTED</option>
        </select>
        <span className="text-xs text-gray-600">
          {records.length} record{records.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Error / Loading ── */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="animate-spin mr-3" size={24} />
          Loading payroll records…
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No payroll records found.</p>
        </div>
      ) : (
        /* ── Records Table ── */
        <div className="overflow-x-auto rounded-[2rem] border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Interpreter
                </th>
                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Period
                </th>
                <th className="px-5 py-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  System Min.
                </th>
                <th className="px-5 py-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Verified Min.
                </th>
                <th className="px-5 py-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Gross
                </th>
                <th className="px-5 py-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Incentive
                </th>
                <th className="px-5 py-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Net
                </th>
                <th className="px-5 py-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Status
                </th>
                <th className="px-5 py-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {records.map((r) => {
                const isActing = actionLoading === r.id;
                const isPaid = r.status === 'PAID' || r.status === 'Pagado';

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Interpreter */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{r.interpreter.name}</div>
                      <div className="text-[11px] text-gray-500">{r.interpreter.externalId}</div>
                    </td>

                    {/* Period */}
                    <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                      {fmtDate(r.periodStart)} — {fmtDate(r.periodEnd)}
                    </td>

                    {/* System minutes */}
                    <td className="px-5 py-4 text-right text-gray-300 font-mono">
                      {minutesToHM(r.totalMinutes)}
                    </td>

                    {/* Verified minutes input */}
                    <td className="px-5 py-4 text-right">
                      {isPaid ? (
                        <span className="text-green-400 font-mono">
                          {r.verifiedMinutes != null ? minutesToHM(r.verifiedMinutes) : '—'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          placeholder={String(r.verifiedMinutes ?? r.totalMinutes)}
                          value={verifyInputs[r.id] ?? ''}
                          onChange={(e) =>
                            setVerifyInputs({ ...verifyInputs, [r.id]: e.target.value })
                          }
                          className="w-24 bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 text-right text-white text-sm focus:border-blue-500/50 transition-colors outline-none"
                        />
                      )}
                    </td>

                    {/* Gross */}
                    <td className="px-5 py-4 text-right text-gray-300 font-mono">
                      {fmt(r.grossTotal)}
                    </td>

                    {/* Incentive */}
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`font-mono ${
                          parseFloat(r.incentivesTotal) > 0
                            ? 'text-emerald-400'
                            : 'text-gray-600'
                        }`}
                      >
                        {fmt(r.incentivesTotal)}
                      </span>
                    </td>

                    {/* Net */}
                    <td className="px-5 py-4 text-right text-white font-bold font-mono">
                      {fmt(r.netTotal)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {!isPaid && (
                          <>
                            <button
                              onClick={() => handleVerify(r.id)}
                              disabled={isActing}
                              title="Verify minutes"
                              className="flex items-center gap-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                            >
                              {isActing ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                <Clock size={12} />
                              )}
                              Verify
                            </button>
                            <button
                              onClick={() => handleMarkPaid(r.id)}
                              disabled={isActing}
                              title="Mark as paid"
                              className="flex items-center gap-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                            >
                              {isActing ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                <DollarSign size={12} />
                              )}
                              Pay
                            </button>
                          </>
                        )}
                        {isPaid && (
                          <span className="text-[11px] text-gray-500">
                            Paid {fmtDate(r.paidAt)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
