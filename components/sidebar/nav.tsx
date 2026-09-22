import Link from "next/link";
import { BellIcon, HomeIcon, KidsIcon, UserIcon } from "../icons";

export type NavId = "feed" | "kids";

const NAV_ITEMS = [
  { id: "feed", label: "Feed", icon: HomeIcon, href: "/" },
  { id: "kids", label: "Niños", icon: KidsIcon, href: "/kids" },
  { id: "avisos", label: "Avisos", icon: BellIcon },
  { id: "cuenta", label: "Mi cuenta", icon: UserIcon },
] as const;

export function Nav({
  active,
  onNavigate,
}: {
  active?: NavId;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        const className = `flex items-center gap-3 rounded-xl px-3 py-[11px] text-[14.5px] ${
          isActive ? "bg-soft font-extrabold text-terracotta" : "font-semibold text-sand"
        }`;
        const content = (
          <>
            <Icon className="flex-none" />
            <span>{item.label}</span>
          </>
        );
        if ("href" in item) {
          return (
            <Link key={item.id} href={item.href} onClick={onNavigate} className={className}>
              {content}
            </Link>
          );
        }
        return (
          <button key={item.id} type="button" onClick={onNavigate} className={className}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}