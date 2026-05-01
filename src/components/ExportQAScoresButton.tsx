'use client';

import React from 'react';
import { Download } from 'lucide-react';

interface QAScore {
  id: number;
  auditDate: string;
  auditor: string | null;
  totalScore: any;
  criticalError: boolean;
  comentarios: string | null;
  interpreter: {
    name: string;
  };
}

interface ExportQAScoresButtonProps {
  data: QAScore[];
}

export function ExportQAScoresButton({ data }: ExportQAScoresButtonProps) {
  const exportToCSV = () => {
    if (!data.length) return;

    const headers = [
      'Date',
      'Interpreter',
      'Auditor',
      'Total Score',
      'Critical Error',
      'Status',
      'Comments'
    ];

    const csvRows = data.map(score => [
      new Date(score.auditDate).toLocaleDateString(),
      `"${score.interpreter.name}"`,
      `"${score.auditor || 'System'}"`,
      `${score.totalScore}%`,
      score.criticalError ? 'YES' : 'NO',
      score.criticalError ? 'FAILED' : 'PASSED',
      `"${(score.comentarios || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `qa_scores_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button 
      onClick={exportToCSV}
      disabled={!data.length}
      className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
    >
      <Download size={20} />
      Export CSV
    </button>
  );
}
