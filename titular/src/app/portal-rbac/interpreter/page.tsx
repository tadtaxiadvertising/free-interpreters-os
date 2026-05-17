import { redirect } from "next/navigation";

export default function InterpreterRootRedirect() {
  redirect("/portal-rbac/interpreter/dashboard");
}
