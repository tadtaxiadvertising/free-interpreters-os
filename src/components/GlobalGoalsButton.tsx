'use client';

import React, { useState } from 'react';
import { Target, Loader2, Check } from 'lucide-react';
import { Modal } from './Modal';
import { updateSystemConfig } from '@/app/actions/settings';

interface Props {
  initialGoal: number;
}

export function GlobalGoalsButton({ initialGoal }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState(initialGoal.toString());
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSave() {
    const val = parseFloat(goal);
    if (isNaN(val) || val <= 0) return;

    setIsPending(true);
    const result = await updateSystemConfig('standard_monthly_goal_hours', val.toString());
    setIsPending(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
      }, 1500);
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
      >
        <Target size={16} />
        Set Global Goals
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Configure Global Goals">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Standard Monthly Goal (Hours)
            </label>
            <div className="relative">
              <input
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                placeholder="e.g. 120"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                hrs/mo
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This will be used as the default goal for all interpreters who don&apos;t have a specific goal set.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || isSuccess}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              {isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isSuccess ? (
                <Check size={16} />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
