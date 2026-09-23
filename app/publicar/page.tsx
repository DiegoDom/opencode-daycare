import CreatePostShell from "@/components/create-post-shell";
import { getFeedData } from "@/lib/feed";
import { getKids } from "@/lib/kids";

export default function PublicarPage() {
  const baseKids = getKids().filter((kid) => kid.room === "Soles");
  const currentUser = getFeedData().currentUser;

  return (
    <div className="flex min-h-screen items-start justify-center bg-canvas p-6 md:p-10">
      <CreatePostShell baseKids={baseKids} currentUser={currentUser} />
    </div>
  );
}