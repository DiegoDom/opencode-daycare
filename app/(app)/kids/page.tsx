import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import KidSearch from "@/components/kid-search";
import KidsShell from "@/components/kids-shell";
import Sidebar from "@/components/sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getFeedDisplay } from "@/lib/feed";
import { getRooms, searchKids } from "@/lib/kids";

export default async function KidsPage({ searchParams }: PageProps<"/kids">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const kids = await searchKids(q);
  const rooms = await getRooms();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/login?error=pending");
  const display = await getFeedDisplay(user);

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar user={display.currentUser} />
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[880px] px-10 py-[34px] pb-20">
          <KidsShell baseKids={kids} rooms={rooms}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Suspense fallback={<div />}>
                  <KidSearch />
                </Suspense>
              </div>
              <div className="hidden items-center gap-2 text-[15px] text-muted md:flex">
                <SearchIcon className="h-5 w-5 text-terracotta" />
                <span>Buscar por nombre, apodo o fecha de nacimiento</span>
              </div>
            </div>
          </KidsShell>
        </div>
      </main>
    </div>
  );
}
