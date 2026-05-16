import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-rbac";

export default async function PortalRbacRoot() {
  const session = await auth();
  
  if (!session) {
    redirect("/portal-rbac/login");
  }

  const role = (session.user as { role?: string })?.role;
  
  if (role === "ADMIN") redirect("/portal-rbac/admin/dashboard");
  if (role === "HOLDER") redirect("/portal-rbac/holder/dashboard");
  if (role === "INTERPRETER") redirect("/portal-rbac/interpreter/dashboard");

  redirect("/portal-rbac/login");
}
