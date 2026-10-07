import { redirect } from "next/navigation";
import ComposeCard from "@/components/compose-card";
import FeedHeader from "@/components/feed-header";
import FeedShell from "@/components/feed-shell";
import SectionDivider from "@/components/section-divider";
import Sidebar from "@/components/sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getFeedDisplay } from "@/lib/feed";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/login?error=pending");

  const feed = await getFeedDisplay(user);

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar user={feed.currentUser} />
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-10 py-[34px] pb-20">
          <FeedHeader
            roomLabel={feed.roomLabel}
            greeting={feed.greeting}
            childrenLine={feed.childrenLine}
          />
          {user.role !== "parent" ? (
            <ComposeCard
              initials={feed.currentUser.initials}
              placeholder={feed.composePlaceholder}
            />
          ) : null}
          <SectionDivider label="PUBLICADO HOY" />

          <FeedShell basePosts={feed.posts} currentUser={feed.currentUser} />
        </div>
      </main>
    </div>
  );
}