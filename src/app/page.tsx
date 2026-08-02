import { redirect } from "next/navigation";
import { currentUser } from "@/lib/rbac";

// Punto de entrada: redirige a la lista de informes o al login.
export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  redirect("/reports");
}
