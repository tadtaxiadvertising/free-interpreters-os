'use client';

import React, { useState } from 'react';
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Key,
  X,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface InterpreterActionsProps {
  interpreter: {
    id: number;
    name: string;
    emailCorporativo: string | null;
  };
}

export function InterpreterActions({ interpreter }: InterpreterActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/interpreters/${interpreter.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert('Error deleting interpreter');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 hover:bg-white/10 rounded-xl transition-colors",
          isOpen ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
        )}
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-48 bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
            <button 
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
              onClick={() => {
                setIsOpen(false);
                // Future: open edit modal
              }}
            >
              <Edit size={16} />
              Edit Profile
            </button>
            <button 
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
              onClick={() => {
                setIsOpen(false);
                // Future: Reset password logic
              }}
            >
              <Key size={16} />
              Reset Password
            </button>
            <div className="h-px bg-white/5 my-1" />
            <button 
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
              onClick={() => {
                setShowDeleteConfirm(true);
                setIsOpen(false);
              }}
            >
              <Trash2 size={16} />
              Delete Account
            </button>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-[#1a1a24] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Delete Interpreter?</h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              This will permanently delete <span className="text-white font-bold">{interpreter.name}</span> and all associated records. This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
