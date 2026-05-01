'use client';

import React, { useState, useCallback } from 'react';
import { Landmark, Hash, IdCard, CreditCard, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── RD Bank Enum ──────────────────────────────────────────────────
// Maintained as Single Source of Truth — matches ADR-004
const RD_BANKS = [
  { value: 'Banreservas', label: 'Banco de Reservas' },
  { value: 'Popular', label: 'Banco Popular Dominicano' },
  { value: 'BHD', label: 'BHD León' },
  { value: 'Scotiabank', label: 'Scotiabank RD' },
  { value: 'Santa Cruz', label: 'Banco Santa Cruz' },
  { value: 'BDI', label: 'Banco BDI' },
  { value: 'Promerica', label: 'Banco Promerica' },
  { value: 'Caribe', label: 'Banco Caribe' },
  { value: 'Otro', label: 'Otro' },
] as const;

const ACCOUNT_TYPES = [
  { value: 'Ahorro', label: 'Cuenta de Ahorro' },
  { value: 'Corriente', label: 'Cuenta Corriente' },
] as const;

// ── Dominican Cédula format: XXX-XXXXXXX-X ──
const CEDULA_REGEX = /^\d{3}-\d{7}-\d{1}$/;

export interface BankFormData {
  bankName: string;
  bankAccount: string;
  bankAccountType: string;
  bankCedula: string;
}

interface BankFormRDProps {
  /** Initial values (for pre-filling when editing) */
  initialData?: Partial<BankFormData>;
  /** Called when all fields are valid and user submits */
  onSubmit: (data: BankFormData) => void;
  /** External loading state (e.g. from useTransition) */
  isLoading?: boolean;
  /** If true, render as standalone card. If false, render just the fields. */
  standalone?: boolean;
}

/**
 * BankFormRD — Banking details form exclusive to Dominican Republic.
 *
 * Validates:
 * - Bank selection from curated RD bank list
 * - Account number (numeric, min 5 chars)
 * - Account type (Ahorro/Corriente)
 * - Cédula/RNC in Dominican format (XXX-XXXXXXX-X)
 *
 * Used by:
 * - OnboardingWizard (Step 2)
 * - Interpreter profile editor (admin)
 */
export function BankFormRD({ initialData, onSubmit, isLoading = false, standalone = false }: BankFormRDProps) {
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [bankAccount, setBankAccount] = useState(initialData?.bankAccount || '');
  const [bankAccountType, setBankAccountType] = useState(initialData?.bankAccountType || '');
  const [bankCedula, setBankCedula] = useState(initialData?.bankCedula || '');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ── Validation ──
  const errors = {
    bankName: !bankName ? 'Selecciona un banco' : '',
    bankAccount: !bankAccount
      ? 'Ingresa el número de cuenta'
      : bankAccount.replace(/\D/g, '').length < 5
        ? 'Mínimo 5 dígitos'
        : '',
    bankAccountType: !bankAccountType ? 'Selecciona el tipo de cuenta' : '',
    bankCedula: !bankCedula
      ? 'Ingresa tu cédula o RNC'
      : !CEDULA_REGEX.test(bankCedula)
        ? 'Formato: XXX-XXXXXXX-X'
        : '',
  };

  const isValid = Object.values(errors).every((e) => e === '');

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // ── Auto-format cédula as user types ──
  function handleCedulaChange(raw: string) {
    // Strip everything except digits and hyphens
    const digits = raw.replace(/[^\d]/g, '');
    let formatted = digits;
    if (digits.length > 3) formatted = digits.slice(0, 3) + '-' + digits.slice(3);
    if (digits.length > 10) formatted = digits.slice(0, 3) + '-' + digits.slice(3, 10) + '-' + digits.slice(10, 11);
    setBankCedula(formatted.slice(0, 13)); // Max: XXX-XXXXXXX-X = 13 chars
  }

  // ── Account number: only digits ──
  function handleAccountChange(raw: string) {
    setBankAccount(raw.replace(/\D/g, ''));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({ bankName, bankAccount, bankAccountType, bankCedula });
  }

  const Wrapper = standalone ? 'div' : 'form';
  const wrapperProps = standalone ? {} : { onSubmit: handleSubmit };

  return (
    <Wrapper {...(wrapperProps as any)} className="space-y-4">
      {/* Banco */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Banco *</label>
        <div className="relative">
          <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <select
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            onBlur={() => markTouched('bankName')}
            id="bank-name-select"
            className={cn(
              "w-full bg-slate-950 border rounded-xl py-3 pl-12 pr-10 text-white focus:outline-none focus:ring-1 transition-all appearance-none",
              touched.bankName && errors.bankName
                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500"
                : "border-slate-800 focus:border-blue-500 focus:ring-blue-500"
            )}
          >
            <option value="">Selecciona tu banco</option>
            {RD_BANKS.map((bank) => (
              <option key={bank.value} value={bank.value}>{bank.label}</option>
            ))}
          </select>
        </div>
        {touched.bankName && errors.bankName && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> {errors.bankName}
          </p>
        )}
      </div>

      {/* Tipo de Cuenta */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Cuenta *</label>
        <div className="relative">
          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <select
            value={bankAccountType}
            onChange={(e) => setBankAccountType(e.target.value)}
            onBlur={() => markTouched('bankAccountType')}
            id="bank-account-type-select"
            className={cn(
              "w-full bg-slate-950 border rounded-xl py-3 pl-12 pr-10 text-white focus:outline-none focus:ring-1 transition-all appearance-none",
              touched.bankAccountType && errors.bankAccountType
                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500"
                : "border-slate-800 focus:border-blue-500 focus:ring-blue-500"
            )}
          >
            <option value="">Selecciona tipo de cuenta</option>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        {touched.bankAccountType && errors.bankAccountType && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> {errors.bankAccountType}
          </p>
        )}
      </div>

      {/* No. de Cuenta */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">No. de Cuenta *</label>
        <div className="relative">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            inputMode="numeric"
            value={bankAccount}
            onChange={(e) => handleAccountChange(e.target.value)}
            onBlur={() => markTouched('bankAccount')}
            placeholder="Ej: 0123456789"
            id="bank-account-input"
            className={cn(
              "w-full bg-slate-950 border rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 transition-all",
              touched.bankAccount && errors.bankAccount
                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500"
                : "border-slate-800 focus:border-blue-500 focus:ring-blue-500"
            )}
          />
          {bankAccount && !errors.bankAccount && (
            <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400" size={16} />
          )}
        </div>
        {touched.bankAccount && errors.bankAccount && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> {errors.bankAccount}
          </p>
        )}
      </div>

      {/* Cédula / RNC */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Cédula / RNC *</label>
        <div className="relative">
          <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            value={bankCedula}
            onChange={(e) => handleCedulaChange(e.target.value)}
            onBlur={() => markTouched('bankCedula')}
            placeholder="001-1234567-8"
            id="bank-cedula-input"
            maxLength={13}
            className={cn(
              "w-full bg-slate-950 border rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 transition-all",
              touched.bankCedula && errors.bankCedula
                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500"
                : "border-slate-800 focus:border-blue-500 focus:ring-blue-500"
            )}
          />
          {bankCedula && !errors.bankCedula && (
            <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400" size={16} />
          )}
        </div>
        {touched.bankCedula && errors.bankCedula && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> {errors.bankCedula}
          </p>
        )}
        <p className="mt-1 text-[11px] text-slate-500">Formato dominicano: XXX-XXXXXXX-X</p>
      </div>

      {/* Validity indicator */}
      {isValid && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 animate-in fade-in duration-300">
          <Check size={14} />
          <span>Todos los campos están completos</span>
        </div>
      )}
    </Wrapper>
  );
}

/** Export validation check for parent components */
export function isBankFormValid(data: Partial<BankFormData>): boolean {
  return !!(
    data.bankName?.trim() &&
    data.bankAccount?.trim() &&
    (data.bankAccount?.replace(/\D/g, '').length ?? 0) >= 5 &&
    data.bankAccountType?.trim() &&
    data.bankCedula?.trim() &&
    CEDULA_REGEX.test(data.bankCedula || '')
  );
}
