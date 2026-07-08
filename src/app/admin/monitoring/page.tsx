import RealTimeMonitor from '@/components/admin/RealTimeMonitor';

export const dynamic = 'force-dynamic';

export default function MonitoringPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Control de Operaciones en Vivo
        </h1>
        <p className="text-gray-400 mt-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Monitoreo en tiempo real de intérpretes activos · Supabase Presence
        </p>
      </header>

      <RealTimeMonitor />
    </div>
  );
}
