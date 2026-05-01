'use client';

import React, { useState, useRef, useEffect, useTransition, useCallback } from 'react';
import { FileText, CreditCard, Compass, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { acceptTerms, saveBankingDetails, completeOnboarding } from '@/app/actions/onboarding';
import { BankFormRD, type BankFormData } from './BankFormRD';

// ── Freelance Contract content (embedded so it works offline) ──
const LEGAL_CONTENT = `# Contrato de Prestación de Servicios Profesionales (Freelance)

**ENTRE:**

De una parte, **FREE INTERPRETERS**, en adelante denominada "LA AGENCIA".

Y de la otra parte, **[SU NOMBRE]**, en adelante denominado "EL INTÉRPRETE".

**ACUERDAN LO SIGUIENTE:**

### 1. Objeto del Contrato
LA AGENCIA contrata a EL INTÉRPRETE para prestar servicios de interpretación remota (VRI/OPI) de manera independiente y autónoma.

### 2. Naturaleza de la Relación
Las partes reconocen que este es un contrato de servicios profesionales (freelance) y **NO** crea una relación laboral de dependencia, sociedad o asociación. EL INTÉRPRETE actúa como contratista independiente.

### 3. Obligaciones del Intérprete
- Prestar servicios de interpretación con los más altos estándares de calidad, precisión y ética profesional.
- Cumplir con los horarios y turnos acordados previamente.
- Contar con el equipo técnico necesario (computadora, headset, conexión a internet estable y entorno silencioso).
- Mantener la confidencialidad absoluta de toda la información tratada durante las sesiones de interpretación.
- Seguir los Procedimientos Operativos Estándar (SOPs) y políticas de LA AGENCIA.

### 4. Confidencialidad y Protección de Datos
EL INTÉRPRETE se compromete a no divulgar, copiar ni utilizar para fines propios o de terceros ninguna información confidencial de LA AGENCIA o de sus clientes finales (incluyendo información médica, legal o financiera), cumpliendo con las normativas HIPAA y otras leyes aplicables.

### 5. Honorarios y Forma de Pago
- **Tarifa:** Se pagará una tarifa según el esquema de producción acordado.
- **Plataformas:** Los pagos se procesarán según el SOP de Pagos vigente.
- **Frecuencia:** Los pagos se realizarán según la validación de los reportes de producción.

### 6. Vigencia y Terminación
Este contrato tiene una vigencia indefinida a partir de la fecha de firma. Cualquiera de las partes puede terminar este contrato con aviso previo por escrito. LA AGENCIA puede terminar el contrato inmediatamente en caso de incumplimiento grave.

### 7. Penalidades
El incumplimiento de los turnos asignados, problemas recurrentes de calidad o faltas al reglamento interno estarán sujetos a penalidades conforme al "Formato de Penalidades" y "SOP de Penalidades" de LA AGENCIA.

### 8. Ley Aplicable
Este contrato se rige por las leyes vigentes en la República Dominicana.

---

Al continuar, usted acepta todos los términos y condiciones establecidos en este documento.`;

const STEPS = [
  { id: 'legal', label: 'Acuerdo Legal', icon: FileText },
  { id: 'banking', label: 'Datos de Pago', icon: CreditCard },
  { id: 'tutorial', label: 'Tutorial', icon: Compass },
] as const;

interface OnboardingWizardProps {
  onComplete: () => void;
  interpreterName?: string;
}

export function OnboardingWizard({ onComplete, interpreterName }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Step 1 – Legal
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  // Step 2 – Banking (managed by BankFormRD)
  const [bankData, setBankData] = useState<BankFormData>({
    bankName: '',
    bankAccount: '',
    bankAccountType: '',
    bankCedula: '',
  });

  // Step 3 – Tutorial
  const [tutorialStep, setTutorialStep] = useState(0);

  // ── Scroll detection for legal step ──
  const handleScroll = useCallback(() => {
    const el = scrollBoxRef.current;
    if (!el) return;
    // Within 40px of the bottom counts as "read"
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) setHasScrolledToBottom(true);
  }, []);

  useEffect(() => {
    const el = scrollBoxRef.current;
    if (currentStep === 0 && el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [currentStep, handleScroll]);

  // ── Step handlers ──
  function handleNextLegal() {
    startTransition(async () => {
      const result = await acceptTerms();
      if (result.success) setCurrentStep(1);
    });
  }

  function handleNextBanking() {
    startTransition(async () => {
      const result = await saveBankingDetails(bankData);
      if (result.success) setCurrentStep(2);
    });
  }

  function handleFinish() {
    startTransition(async () => {
      const result = await completeOnboarding();
      if (result.success) onComplete();
    });
  }

  const isBankingValid =
    bankData.bankName.trim() &&
    bankData.bankAccount.trim() &&
    bankData.bankAccountType.trim() &&
    bankData.bankCedula.trim();

  const tutorialHighlights = [
    {
      title: '⏱️ Temporizador de Llamadas',
      description: 'Tu herramienta principal. Presiona "Iniciar Llamada" cuando comiences una interpretación. El tiempo se registra automáticamente, incluso si cambias de pestaña.',
    },
    {
      title: '📊 Tu Ranking',
      description: 'Compara tu rendimiento con el promedio de la plataforma. Los intérpretes con mejor score obtienen más oportunidades y bonificaciones.',
    },
    {
      title: '💰 Registro Rápido',
      description: 'Si olvidaste iniciar el temporizador, usa "Registro Rápido" al lado del botón de llamada para registrar minutos manualmente.',
    },
    {
      title: '🎯 Metas Mensuales',
      description: 'Tu meta de minutos se actualiza según tu perfil. Mantente al día para alcanzar el 100% y maximizar tus ganancias.',
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500">
        {/* Background glow */}
        <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/10 rounded-[2rem] blur-xl pointer-events-none" />

        <div className="relative bg-slate-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          {/* ── Stepper Header ── */}
          <div className="px-8 pt-8 pb-4">
            <h2 className="text-2xl font-bold text-white mb-1">
              ¡Bienvenido{interpreterName ? `, ${interpreterName}` : ''}! 🎉
            </h2>
            <p className="text-sm text-slate-400 mb-6">Completa estos 3 pasos para activar tu portal.</p>

            <div className="flex items-center gap-2">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isCompleted = i < currentStep;
                const isCurrent = i === currentStep;
                return (
                  <React.Fragment key={step.id}>
                    <div className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-500",
                      isCompleted && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20",
                      isCurrent && "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]",
                      !isCompleted && !isCurrent && "bg-slate-800/50 text-slate-500 border border-white/5",
                    )}>
                      {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                      <span className="hidden sm:inline">{step.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={cn(
                        "w-8 h-0.5 rounded-full transition-colors duration-500",
                        isCompleted ? "bg-emerald-500/40" : "bg-slate-700"
                      )} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ── Step Content ── */}
          <div className="px-8 py-6 min-h-[400px] flex flex-col">
            {/* STEP 1: Legal */}
            {currentStep === 0 && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <FileText size={20} className="text-blue-400" />
                  Acuerdo de Confidencialidad y Contrato
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Lee el documento completo. El botón se habilitará al llegar al final.
                </p>

                <div
                  ref={scrollBoxRef}
                  className="flex-1 max-h-[280px] overflow-y-auto bg-slate-950/60 border border-white/5 rounded-2xl p-6 text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none scrollbar-thin"
                >
                  {LEGAL_CONTENT.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mb-4">{line.replace('# ', '')}</h1>;
                    if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-blue-300 mt-4 mb-2">{line.replace('### ', '')}</h3>;
                    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-white">{line.replace(/\*\*/g, '')}</p>;
                    if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-slate-300">{line.replace('- ', '')}</li>;
                    if (line === '---') return <hr key={i} className="border-white/10 my-4" />;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="mb-1">{line}</p>;
                  })}
                </div>

                {/* Scroll indicator */}
                {!hasScrolledToBottom && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs text-amber-400/80 animate-pulse">
                    <ChevronRight size={14} className="rotate-90" />
                    <span>Desplázate hacia abajo para continuar</span>
                  </div>
                )}

                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleNextLegal}
                    disabled={!hasScrolledToBottom || isPending}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300",
                      hasScrolledToBottom && !isPending
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 hover:-translate-y-0.5"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    )}
                  >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <>Acepto los Términos <ChevronRight size={18} /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Banking — uses the BankFormRD component */}
            {currentStep === 1 && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <CreditCard size={20} className="text-blue-400" />
                  Datos de Pago (Transferencia Bancaria RD)
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Ingresa los datos bancarios dominicanos para recibir tus pagos por transferencia.
                </p>

                <div className="flex-1">
                  <BankFormRD
                    initialData={bankData}
                    onSubmit={(data) => {
                      setBankData(data);
                      handleNextBanking();
                    }}
                    isLoading={isPending}
                    standalone={true}
                  />
                  {/* Live update bank data on field changes via controlled state */}
                  <BankDataSync bankData={bankData} setBankData={setBankData} />
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setCurrentStep(0)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <ChevronLeft size={18} /> Atrás
                  </button>
                  <button
                    onClick={handleNextBanking}
                    disabled={!isBankingValid || isPending}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300",
                      isBankingValid && !isPending
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 hover:-translate-y-0.5"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    )}
                  >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <>Siguiente <ChevronRight size={18} /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Tutorial */}
            {currentStep === 2 && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Compass size={20} className="text-blue-400" />
                  Tour Rápido
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Conoce las funciones principales de tu portal.
                </p>

                {/* Tutorial cards */}
                <div className="flex-1 space-y-3">
                  {tutorialHighlights.map((item, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-4 rounded-2xl border transition-all duration-500 cursor-pointer",
                        tutorialStep === i
                          ? "bg-blue-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                          : "bg-slate-800/30 border-white/5 hover:bg-slate-800/50"
                      )}
                      onClick={() => setTutorialStep(i)}
                    >
                      <h4 className="text-base font-bold text-white mb-1">{item.title}</h4>
                      {tutorialStep === i && (
                        <p className="text-sm text-slate-300 animate-in fade-in slide-in-from-top-2 duration-300">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <ChevronLeft size={18} /> Atrás
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={isPending}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <>¡Empezar! 🚀</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Internal helper: Syncs BankFormRD field values back to OnboardingWizard state.
 * BankFormRD uses its own internal state, but on mount we pre-fill from parent.
 * This component listens for DOM changes to keep parent state in sync.
 */
function BankDataSync({
  bankData: _,
  setBankData,
}: {
  bankData: BankFormData;
  setBankData: React.Dispatch<React.SetStateAction<BankFormData>>;
}) {
  useEffect(() => {
    // Observe select/input changes via event delegation
    function handleChange(e: Event) {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      if (!target?.id) return;

      setBankData((prev) => {
        switch (target.id) {
          case 'bank-name-select':
            return { ...prev, bankName: target.value };
          case 'bank-account-type-select':
            return { ...prev, bankAccountType: target.value };
          case 'bank-account-input':
            return { ...prev, bankAccount: target.value };
          case 'bank-cedula-input':
            return { ...prev, bankCedula: target.value };
          default:
            return prev;
        }
      });
    }

    document.addEventListener('input', handleChange);
    document.addEventListener('change', handleChange);
    return () => {
      document.removeEventListener('input', handleChange);
      document.removeEventListener('change', handleChange);
    };
  }, [setBankData]);

  return null;
}
