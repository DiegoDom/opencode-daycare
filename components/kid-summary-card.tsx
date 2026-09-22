import { LogoIcon } from "./icons";

export default function KidSummaryCard() {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-[9px] rounded-[14px] bg-ink px-4 py-[13px] text-[15px] font-extrabold text-white"
    >
      <LogoIcon />
      Resumen del día
    </button>
  );
}