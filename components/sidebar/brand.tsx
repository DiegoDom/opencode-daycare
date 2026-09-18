import { LogoIcon } from "../icons";

interface BrandProps {
  variant?: "stacked" | "inline";
}

export function Brand({ variant = "stacked" }: BrandProps) {
  if (variant === "inline") {
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