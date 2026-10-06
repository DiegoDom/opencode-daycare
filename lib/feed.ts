import { feedData, type FeedData, type Post, type PostType } from "@/data/mock/feed";
import {
  firstName,
  initialsFrom,
  ROLE_LABELS,
  shortDaycareName,
  type SessionUser,
} from "@/lib/auth";

export type { FeedData, Post, PostType };

export function getFeedData(): FeedData {
  return feedData;
}

export interface FeedDisplay {
  roomLabel: string;
  greeting: string;
  childrenLine: string;
  composePlaceholder: string;
  currentUser: {
    name: string;
    initials: string;
    role: string;
  };
  posts: Post[];
}

export function getFeedDisplay(user: SessionUser): FeedDisplay {
  const roleLabel = `${ROLE_LABELS[user.role]}${user.daycareName ? " · " + shortDaycareName(user.daycareName) : ""}`;
  return {
    roomLabel: user.daycareName ? `GUARDERÍA · ${shortDaycareName(user.daycareName)}` : "GUARDERÍA",
    greeting: `Buenas, ${firstName(user.fullName)}`,
    childrenLine: feedData.childrenLine,
    composePlaceholder: feedData.composePlaceholder,
    currentUser: {
      name: user.fullName,
      initials: initialsFrom(user.fullName),
      role: roleLabel,
    },
    posts: feedData.posts,
  };
}