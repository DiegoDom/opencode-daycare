"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CloseIcon, MenuIcon } from "../icons";
import { Brand } from "./brand";
import type { NavId } from "./nav";
import { SidebarContent } from "./sidebar-content";
import type { SidebarUser } from "./user-footer";

export type { SidebarUser } from "./user-footer";

export default function Sidebar({ user }: { user: SidebarUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const active: NavId | undefined =
    pathname === "/" ? "feed" : pathname.startsWith("/ninos") ? "kids" : undefined;

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
        <SidebarContent user={user} active={active} />
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
        <Brand variant="inline" />
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
        <SidebarContent
          user={user}
          active={active}
          onAction={() => setOpen(false)}
          brand={
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
          }
        />
      </div>
    </>
  );
}