import { BellIcon, HomeIcon, KidsIcon, UserIcon } from "../icons";

const NAV_ITEMS = [
  { label: "Feed", icon: HomeIcon, active: true },
  { label: "Niños", icon: KidsIcon, active: false },
  { label: "Avisos", icon: BellIcon, active: false },
  { label: "Mi cuenta", icon: UserIcon, active: false },
];

export function Nav({ onNavigate }: { onNavigate?: () => void }) {
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