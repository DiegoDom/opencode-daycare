import { Suspense } from "react";
import { SearchIcon } from "@/components/icons";
import KidSearch from "@/components/kid-search";
import KidsShell from "@/components/kids-shell";
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
          <KidsShell baseKids={kids} query={q}>
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
          </KidsShell>
        </div>
      </main>
    </div>
  );
}