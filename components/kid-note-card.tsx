import type { KidNote } from "@/lib/kids";
import { AlertIcon } from "./icons";

export default function KidNoteCard({ note }: { note: KidNote }) {
  return (
    <div className="flex gap-[14px] rounded-2xl bg-[#FBDAD6] px-[18px] py-4">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[#F4A8A0] text-white">
        <AlertIcon />
      </span>
      <div className="min-w-0">
        <div className="mb-[2px] text-[15px] font-extrabold text-[#C5413A]">{note.title}</div>
        <div className="text-[14.5px] leading-[1.5] text-[#B25249]">{note.text}</div>
      </div>
    </div>
  );
}