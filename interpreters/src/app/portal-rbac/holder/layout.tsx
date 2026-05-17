import RbacShell from "@/components/rbac-shell";

export default function HolderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RbacShell requiredRole="HOLDER">{children}</RbacShell>;
}
