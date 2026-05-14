'use client';

import React, { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Modal } from './Modal';
import { InterpreterForm } from './InterpreterForm';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface AddInterpreterButtonProps {
  label?: string;
  mode?: 'create' | 'edit';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any;
  variant?: 'primary' | 'ghost';
}

export function AddInterpreterButton({ 
  label = "Add Interpreter", 
  mode = 'create', 
  initialData,
  variant = 'primary'
}: AddInterpreterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setIsOpen(false);
    router.refresh();
  };

  const isEdit = mode === 'edit';

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center justify-center gap-2 transition-all font-bold rounded-2xl",
          variant === 'primary' 
            ? "bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 glow shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
            : "w-full py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 text-xs"
        )}
      >
        {isEdit ? <Settings2 size={variant === 'primary' ? 20 : 16} /> : <Plus size={20} />}
        {label}
      </button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title={isEdit ? `Update Profile: ${initialData?.name || 'Interpreter'}` : "Register New Interpreter"}
      >
        <div className="max-h-[80vh] overflow-y-auto px-1">
          <InterpreterForm 
            initialData={initialData}
            interpreterId={initialData?.id as number | undefined}
            onSuccess={handleSuccess} 
            onCancel={() => setIsOpen(false)} 
          />
        </div>
      </Modal>
    </>
  );
}
