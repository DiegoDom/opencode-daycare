import { PlusIcon } from "../icons";

export function NewPostButton({ onAction }: { onAction?: () => void }) {
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