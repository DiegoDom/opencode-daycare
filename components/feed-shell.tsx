"use client";

import { useEffect, useState } from "react";
import PostCard from "./post-card";
import type { Post } from "@/lib/feed";

const POSTS_KEY = "opdaycare.posts.v1";

interface FeedShellProps {
  basePosts: Post[];
  currentUser: { name: string; initials: string; role: string };
}

export default function FeedShell({ basePosts }: FeedShellProps) {
  const [storedPosts, setStoredPosts] = useState<Post[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(POSTS_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setStoredPosts(parsed as Post[]);
        }
      } catch {
        // localStorage deshabilitado: solo el mock
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {[...storedPosts, ...basePosts].map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}