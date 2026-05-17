import RbacShell from "@/components/rbac-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RbacShell requiredRole="ADMIN">{children}</RbacShell>;
}
