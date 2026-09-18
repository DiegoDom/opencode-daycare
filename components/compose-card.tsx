import { CameraIcon } from "./icons";

interface ComposeCardProps {
  initials: string;
  placeholder: string;
}

export default function ComposeCard({ initials, placeholder }: ComposeCardProps) {
  return (
    <button
      type="button"
      className="mb-6 flex w-full items-center gap-[14px] rounded-[18px] border border-line bg-card px-[18px] py-[14px] text-left shadow-[0_4px_14px_-10px_rgba(120,90,60,0.4)]"
    >
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-avatar-sun font-display text-base font-semibold text-white">
        {initials}
      </div>
      <span className="flex-1 text-[15px] text-faint">{placeholder}</span>
      <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-soft text-coral-dark">
        <CameraIcon />
      </span>
    </button>
  );
}