import CreatePostShell from "@/components/create-post-shell";
import { getCurrentUser } from "@/lib/auth";
import { getFeedDisplay } from "@/lib/feed";
import { getKids } from "@/lib/kids";
import { redirect } from "next/navigation";

export default async function PublicarPage() {
  const baseKids = (await getKids()).filter((kid) => kid.room === "Soles");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/login?error=pending");
  const display = getFeedDisplay(user);

  return (
    <div className="flex min-h-screen items-start justify-center bg-canvas p-6 md:p-10">
      <CreatePostShell baseKids={baseKids} currentUser={display.currentUser} />
    </div>
  );
}