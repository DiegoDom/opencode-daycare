import { feedData, type FeedData, type Post, type PostType } from "@/data/mock/feed";

export type { FeedData, Post, PostType };

export function getFeedData(): FeedData {
  return feedData;
}