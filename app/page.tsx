import ComposeCard from "@/components/compose-card";
import FeedHeader from "@/components/feed-header";
import PostCard from "@/components/post-card";
import SectionDivider from "@/components/section-divider";
import Sidebar from "@/components/sidebar";
import { getFeedData } from "@/lib/feed";

export default function Home() {
  const feed = getFeedData();

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
          <ComposeCard
            initials={feed.currentUser.initials}
            placeholder={feed.composePlaceholder}
          />
          <SectionDivider label="PUBLICADO HOY" />

          <div className="flex flex-col gap-4">
            {feed.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}