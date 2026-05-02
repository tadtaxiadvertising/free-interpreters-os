'use client';

import React from 'react';
import { Download } from 'lucide-react';

interface Interpreter {
  id: number;
  externalId: string;
  name: string;
  emailCorporativo: string | null;
  status: string;
  campaign: string | null;
  tariffPerMinute: any;
  createdAt: string | Date;
}

interface ExportInterpretersButtonProps {
  data: Interpreter[];
}

export function ExportInterpretersButton({ data }: ExportInterpretersButtonProps) {
  const exportToCSV = () => {
    if (!data.length) return;

    const headers = [
      'ID',
      'External ID',
      'Name',
      'Email',
      'Status',
      'Campaign',
      'Tariff/Min',
      'Tariff/Hour',
      'Created At'
    ];

    const csvRows = data.map(interpreter => [
      interpreter.id,
      interpreter.externalId,
      `"${interpreter.name}"`,
      interpreter.emailCorporativo || 'N/A',
      interpreter.status,
      `"${interpreter.campaign || 'N/A'}"`,
      interpreter.tariffPerMinute,
      (parseFloat(interpreter.tariffPerMinute.toString()) * 60).toFixed(2),
      new Date(interpreter.createdAt).toLocaleDateString()
    ].join(','));

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `interpreters_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button 
      onClick={exportToCSV}
      disabled={!data.length}
      className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
    >
      <Download size={20} />
      Export CSV
    </button>
  );
}
