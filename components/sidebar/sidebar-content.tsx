import type { ReactNode } from "react";
import { Brand } from "./brand";
import { NewPostButton } from "./new-post-button";
import { Nav, type NavId } from "./nav";
import { UserFooter, type SidebarUser } from "./user-footer";

interface SidebarContentProps {
  user: SidebarUser;
  brand?: ReactNode;
  active?: NavId;
  onNavigate?: () => void;
  onLogout?: () => void;
  isPending?: boolean;
}

export function SidebarContent({
  user,
  brand = <Brand />,
  active,
  onNavigate,
  onLogout,
  isPending,
}: SidebarContentProps) {
  return (
    <>
      {brand}
      <div className="mt-6">{user.isParent ? null : <NewPostButton onNavigate={onNavigate} />}</div>
      <Nav active={active} onNavigate={onNavigate} />
      <div className="mt-auto border-t border-line pt-3.5">
        <UserFooter user={user} onAction={onLogout} isPending={isPending} />
      </div>
    </>
  );
}