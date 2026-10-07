import PostCard from "./post-card";
import type { Post } from "@/lib/feed";

interface FeedShellProps {
  basePosts: Post[];
}

export default function FeedShell({ basePosts }: FeedShellProps) {
  return (
    <div className="flex flex-col gap-4">
      {basePosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}