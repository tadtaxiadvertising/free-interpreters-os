import RealTimeMonitor from '@/components/admin/RealTimeMonitor';
import AlertBanner from '@/components/admin/AlertBanner';

export const dynamic = 'force-dynamic';

export default function MonitoringPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Page Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/30" />
            Intérpretes en Vivo
          </h1>
          <p className="text-gray-400 mt-1.5 ml-6">
            Monitoreo en tiempo real con estados inteligentes y sesiones activas
          </p>
        </div>
        <AlertBanner autoDetect={true} />
      </header>

      {/* Main Monitor */}
      <RealTimeMonitor />
    </div>
  );
}