import { notFound, redirect } from "next/navigation";
import KidProfileShell from "@/components/kid-profile-shell";
import Sidebar from "@/components/sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getFeedDisplay } from "@/lib/feed";
import { getKidById } from "@/lib/kids";

export default async function KidProfilePage({ params }: PageProps<"/kids/[id]">) {
  const { id } = await params;
  const kid = getKidById(id);
  if (!kid) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/login?error=pending");
  const display = getFeedDisplay(user);

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar user={display.currentUser} />
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <KidProfileShell baseKid={kid} />
      </main>
    </div>
  );
}