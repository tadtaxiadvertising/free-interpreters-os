'use client';

import React from 'react';
import { Plus } from 'lucide-react';

export function AddInterpreterButton() {
  const handleClick = () => {
    alert("Add Interpreter form functionality to be implemented. (Client interactivity restored)");
  };

  return (
    <button 
      onClick={handleClick}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all glow"
    >
      <Plus size={20} />
      Add Interpreter
    </button>
  );
}
