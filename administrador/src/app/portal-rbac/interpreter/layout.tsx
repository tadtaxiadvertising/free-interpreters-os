import RbacShell from "@/components/rbac-shell";

export default function InterpreterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RbacShell requiredRole="INTERPRETER">{children}</RbacShell>;
}
