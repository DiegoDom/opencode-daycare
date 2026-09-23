import { notFound } from "next/navigation";
import KidProfileShell from "@/components/kid-profile-shell";
import Sidebar from "@/components/sidebar";
import { getFeedData } from "@/lib/feed";
import { getKidById, getKids } from "@/lib/kids";

export function generateStaticParams() {
  return getKids().map((kid) => ({ id: kid.id }));
}

export default async function KidProfilePage({ params }: PageProps<"/kids/[id]">) {
  const { id } = await params;
  const kid = getKidById(id);
  if (!kid) notFound();

  const currentUser = getFeedData().currentUser;

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar user={currentUser} />
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <KidProfileShell baseKid={kid} />
      </main>
    </div>
  );
}