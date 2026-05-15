import InterpreterDashboard from "@/components/interpreters/InterpreterDashboard";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function InterpreterCompliancePage({ params }: Props) {
  // En Next.js 16+, params en rutas dinámicas deben ser tratados como Promise
  const resolvedParams = await params;
  const interpreterId = parseInt(resolvedParams.id, 10);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Mi Smart Commitment Calendar</h1>
      <InterpreterDashboard interpreterId={interpreterId} />
    </div>
  );
}
