import { redirect } from "next/navigation";
import { currentUser } from "@/lib/rbac";
import { AppHeader } from "@/components/AppHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      {children}
    </div>
  );
}
