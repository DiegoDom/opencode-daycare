import { type Ref } from "react";
import { PlusIcon } from "./icons";

interface KidsHeaderProps {
  onAdd?: () => void;
  addRef?: Ref<HTMLButtonElement>;
}

export default function KidsHeader({ onAdd, addRef }: KidsHeaderProps) {
  return (
    <div className="mb-[22px] flex items-end justify-between gap-4">
      <div>
        <div className="mb-1 text-[12.5px] font-extrabold tracking-[0.8px] text-terracotta">
          GESTIÓN
        </div>
        <h1 className="font-display text-[30px] font-semibold text-ink">Niños</h1>
      </div>
      {onAdd ? (
        <button
          ref={addRef}
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 rounded-[14px] bg-gradient-to-b from-peach to-coral px-[18px] py-[11px] text-[14.5px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(238,129,100,0.7)]"
        >
          <PlusIcon />
          Agregar niño
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-[14px] bg-gradient-to-b from-peach to-coral px-[18px] py-[11px] text-[14.5px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(238,129,100,0.7)]">
          <PlusIcon />
          Agregar niño
        </div>
      )}
    </div>
  );
}