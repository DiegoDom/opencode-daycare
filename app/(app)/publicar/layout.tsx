import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function PublicarLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active" || user.role === "parent") {
    redirect("/");
  }
  return children;
}