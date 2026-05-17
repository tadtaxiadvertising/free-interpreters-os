import { redirect } from "next/navigation";

export default function AdminRootRedirect() {
  redirect("/portal-rbac/admin/dashboard");
}
