"use client";
import React, { useState } from "react";

interface RbacActionContainerProps {
  title: string;
  description?: string;
  buttonLabel: string;
  children: React.ReactNode;
}

export function RbacActionContainer({
  title,
  description,
  buttonLabel,
  children,
}: RbacActionContainerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden mb-8 transition-all">
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.01]">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${
            isOpen
              ? "bg-white/10 text-white border border-white/10 hover:bg-white/20"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/25"
          }`}
        >
          {isOpen ? "Cancelar" : buttonLabel}
        </button>
      </div>

      {isOpen && (
        <div className="p-8 bg-black/20 animate-in fade-in slide-in-from-top-4 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}
