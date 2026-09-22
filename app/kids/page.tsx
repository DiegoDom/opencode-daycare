import { Suspense } from "react";
import { SearchIcon } from "@/components/icons";
import KidCard from "@/components/kid-card";
import KidSearch from "@/components/kid-search";
import KidsEmpty from "@/components/kids-empty";
import KidsHeader from "@/components/kids-header";
import Sidebar from "@/components/sidebar";
import { getFeedData } from "@/lib/feed";
import { searchKids } from "@/lib/kids";

export default async function KidsPage({ searchParams }: PageProps<"/kids">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const kids = searchKids(q);
  const currentUser = getFeedData().currentUser;

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar user={currentUser} />
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[880px] px-10 py-[34px] pb-20">
          <KidsHeader />

          <Suspense
            fallback={
              <div className="mb-6 flex items-center gap-[11px] rounded-[14px] border border-line bg-card px-4 py-3">
                <span className="flex-none text-[#B0A290]">
                  <SearchIcon />
                </span>
              </div>
            }
          >
            <KidSearch />
          </Suspense>

          <div className="mb-[14px] flex items-center gap-3">
            <span className="text-[12.5px] font-extrabold tracking-[0.8px] text-ink">
              SALA SOLES
            </span>
            <span className="text-[13px] text-faint">{kids.length} niños</span>
            <span className="h-px flex-1 bg-[#E7DAC8]" />
          </div>

          {kids.length === 0 ? (
            <KidsEmpty />
          ) : (
            <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
              {kids.map((kid) => (
                <KidCard key={kid.id} kid={kid} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}