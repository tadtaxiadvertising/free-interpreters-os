import React from "react";
import { getPerformanceHistory } from "@/lib/performance-history";
import { PerformanceHistoryPanel } from "@/components/interpreters/PerformanceHistoryPanel";
import { notFound } from "next/navigation";

// Regla de Oro 2: Rutas Dinámicas en Next.js 15 (params es una Promesa)
type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function PerformancePage({ params }: Props) {
  const resolvedParams = await params;
  const interpreterId = parseInt(resolvedParams.id, 10);

  if (isNaN(interpreterId)) {
    notFound();
  }

  const now = new Date();
  
  try {
    // Obtenemos los datos históricos unificados y calculados desde el servidor
    const data = await getPerformanceHistory(interpreterId, now.getUTCFullYear(), now.getUTCMonth() + 1);

    return (
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Panel de Historial Profesional</h1>
          <p className="text-gray-400">
            Intérprete: <span className="font-semibold text-gray-200">{data.interpreterName}</span> 
            {data.interpreterExternalId && ` (${data.interpreterExternalId})`}
          </p>
        </header>
        
        {/* Renderizamos el Client Component pasándole la data procesada en el Servidor */}
        <PerformanceHistoryPanel data={data} />
      </div>
    );
  } catch (error) {
    console.error("[PerformancePage] Error:", error);
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400">
          <h2 className="text-xl font-bold mb-2">Error cargando el historial</h2>
          <p>No se pudo cargar el historial de rendimiento para este intérprete. Verifica que el ID sea correcto.</p>
        </div>
      </div>
    );
  }
}
