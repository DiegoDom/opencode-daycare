"use client";

import { useEffect, useState } from "react";
import {
  BellIcon,
  CloseIcon,
  HomeIcon,
  KidsIcon,
  LogoIcon,
  LogoutIcon,
  MenuIcon,
  PlusIcon,
  UserIcon,
} from "./icons";

export interface SidebarUser {
  name: string;
  initials: string;
  role: string;
}

const NAV_ITEMS = [
  { label: "Feed", icon: HomeIcon, active: true },
  { label: "Niños", icon: KidsIcon, active: false },
  { label: "Avisos", icon: BellIcon, active: false },
  { label: "Mi cuenta", icon: UserIcon, active: false },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#F8C3A8] to-[#F2937A]">
        <LogoIcon className="text-white" />
      </div>
      <div>
        <div className="font-display text-[17px] font-semibold leading-none text-ink">
          OpenDayCare
        </div>
        <div className="mt-0.5 text-[11.5px] text-faint">Sala Soles</div>
      </div>
    </div>
  );
}

function MobileBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F8C3A8] to-[#F2937A]">
        <LogoIcon className="text-white" />
      </div>
      <span className="font-display text-[16px] font-semibold text-ink">
        OpenDayCare · Sala Soles
      </span>
    </div>
  );
}

function NewPostButton({ onAction }: { onAction?: () => void }) {
  return (
    <button
      type="button"
      onClick={onAction}
      className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-peach to-coral px-4 py-3 text-[14.5px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(238,129,100,0.75)]"
    >
      <PlusIcon />
      Nueva publicación
    </button>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-[11px] text-[14.5px] ${
              item.active
                ? "bg-soft font-extrabold text-terracotta"
                : "font-semibold text-sand"
            }`}
          >
            <Icon className="flex-none" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function UserFooter({ user, onAction }: { user: SidebarUser; onAction?: () => void }) {
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
        className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-canvas text-muted"
      >
        <LogoutIcon />
      </button>
    </div>
  );
}

export default function Sidebar({ user }: { user: SidebarUser }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <aside className="hidden w-[248px] flex-none flex-col border-r border-line bg-card px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:py-6">
        <Brand />
        <div className="mt-6">
          <NewPostButton />
        </div>
        <Nav />
        <div className="mt-auto border-t border-line pt-3.5">
          <UserFooter user={user} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-card px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="feed-drawer"
          aria-label="Abrir menú"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-soft text-terracotta-deep"
        >
          <MenuIcon />
        </button>
        <MobileBrand />
      </header>

      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id="feed-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-card px-4 py-6 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-canvas text-muted"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="mt-6">
          <NewPostButton onAction={() => setOpen(false)} />
        </div>
        <Nav onNavigate={() => setOpen(false)} />
        <div className="mt-auto border-t border-line pt-3.5">
          <UserFooter user={user} onAction={() => setOpen(false)} />
        </div>
      </div>
    </>
  );
}