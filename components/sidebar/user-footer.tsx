import { LogoutIcon } from "../icons";

export interface SidebarUser {
  name: string;
  initials: string;
  role: string;
  isParent: boolean;
}

export function UserFooter({
  user,
  onAction,
  isPending,
}: {
  user: SidebarUser;
  onAction?: () => void;
  isPending?: boolean;
}) {
  return (
    <div className="flex items-center gap-[11px] px-2 py-1.5">
      <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-avatar-sun font-display text-base font-semibold text-white">
        {user.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-extrabold text-ink">{user.name}</div>
        <div className="truncate text-xs text-faint">{user.role}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        disabled={isPending}
        aria-busy={isPending}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-canvas text-muted disabled:opacity-60"
      >
        <LogoutIcon />
      </button>
    </div>
  );
}