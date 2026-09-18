import type { ReactNode } from "react";
import { Brand } from "./brand";
import { NewPostButton } from "./new-post-button";
import { Nav } from "./nav";
import { UserFooter, type SidebarUser } from "./user-footer";

interface SidebarContentProps {
  user: SidebarUser;
  brand?: ReactNode;
  onAction?: () => void;
}

export function SidebarContent({ user, brand = <Brand />, onAction }: SidebarContentProps) {
  return (
    <>
      {brand}
      <div className="mt-6">
        <NewPostButton onAction={onAction} />
      </div>
      <Nav onNavigate={onAction} />
      <div className="mt-auto border-t border-line pt-3.5">
        <UserFooter user={user} onAction={onAction} />
      </div>
    </>
  );
}