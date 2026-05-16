import { redirect } from "next/navigation";

export default function HolderRootRedirect() {
  redirect("/portal-rbac/holder/dashboard");
}
