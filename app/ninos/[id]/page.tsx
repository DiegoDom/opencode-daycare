import { notFound } from "next/navigation";
import KidDataCard from "@/components/kid-data-card";
import KidNoteCard from "@/components/kid-note-card";
import KidParentsCard from "@/components/kid-parents-card";
import KidProfileHeader from "@/components/kid-profile-header";
import KidSummaryCard from "@/components/kid-summary-card";
import Sidebar from "@/components/sidebar";
import { getFeedData } from "@/lib/feed";
import { getKidById, getKids } from "@/lib/kids";

export function generateStaticParams() {
  return getKids().map((kid) => ({ id: kid.id }));
}

export default async function KidProfilePage({ params }: PageProps<"/ninos/[id]">) {
  const { id } = await params;
  const kid = getKidById(id);
  if (!kid) notFound();

  const currentUser = getFeedData().currentUser;

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar user={currentUser} />
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[820px] px-10 py-[34px] pb-20">
          <KidProfileHeader kid={kid} />

          <div className="mt-[26px] flex flex-col gap-[18px] md:flex-row md:items-start md:gap-[26px]">
            <div className="flex min-w-0 flex-col gap-[18px] md:flex-1">
              {kid.note ? <KidNoteCard note={kid.note} /> : null}
              <KidDataCard kid={kid} />
            </div>

            <div className="flex flex-col gap-[14px] md:w-[300px] md:flex-none">
              <KidSummaryCard />
              <KidParentsCard kid={kid} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}