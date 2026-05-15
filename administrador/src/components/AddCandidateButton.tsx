'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from './Modal';
import { CandidateForm } from './CandidateForm';
import { useRouter } from 'next/navigation';

export function AddCandidateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setIsOpen(false);
    router.refresh();
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all glow shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
      >
        <Plus size={20} />
        New Application
      </button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title="Register New Candidate"
      >
        <CandidateForm 
          onSuccess={handleSuccess} 
          onCancel={() => setIsOpen(false)} 
        />
      </Modal>
    </>
  );
}
