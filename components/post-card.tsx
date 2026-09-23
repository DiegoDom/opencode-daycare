import Image from "next/image";
import type { Post } from "@/lib/feed";
import { CommentIcon, HeartIcon, MegaphoneIcon, PhotoIcon } from "./icons";

const BADGES: Record<
  Post["type"],
  { label: string; bg: string; dot: string; text: string }
> = {
  comida: {
    label: "COMIDA",
    bg: "bg-badge-honey-bg",
    dot: "bg-badge-honey",
    text: "text-badge-honey",
  },
  siesta: {
    label: "SIESTA",
    bg: "bg-badge-lavender-bg",
    dot: "bg-badge-lavender",
    text: "text-badge-lavender",
  },
  actividad: {
    label: "ACTIVIDAD",
    bg: "bg-badge-blue-bg",
    dot: "bg-badge-blue",
    text: "text-badge-blue",
  },
  logro: {
    label: "LOGRO",
    bg: "bg-badge-green-bg",
    dot: "bg-badge-green",
    text: "text-badge-green",
  },
  animo: {
    label: "ÁNIMO",
    bg: "bg-badge-rose-bg",
    dot: "bg-badge-rose",
    text: "text-badge-rose",
  },
  foto: {
    label: "FOTO",
    bg: "bg-badge-coral-bg",
    dot: "bg-badge-coral",
    text: "text-badge-coral",
  },
  anuncio: {
    label: "ANUNCIO",
    bg: "bg-badge-indigo-bg",
    dot: "bg-badge-indigo",
    text: "text-badge-indigo",
  },
};

export default function PostCard({ post }: { post: Post }) {
  const badge = BADGES[post.type];

  return (
    <article className="rounded-[20px] border border-line bg-card px-[22px] py-5 shadow-[0_4px_16px_-12px_rgba(120,90,60,0.5)]">
      <header className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full font-display text-[17px] font-semibold"
          style={{ backgroundColor: post.author.avatarBg, color: post.author.avatarColor }}
        >
          {post.author.initials === "" ? <MegaphoneIcon /> : post.author.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[16.5px] font-semibold text-ink">
            {post.author.name}
          </div>
          <div className="text-[12.5px] text-faint">
            {post.time} · {post.publishedBy}
          </div>
        </div>
        <span className={`flex flex-none items-center gap-[7px] rounded-full px-3 py-1.5 ${badge.bg}`}>
          <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
          <span className={`text-xs font-extrabold tracking-[0.5px] ${badge.text}`}>
            {badge.label}
          </span>
        </span>
      </header>

      <div className="mt-3 text-[12.5px] text-faint">{post.audience}</div>

      {post.recipients && post.recipients.length > 0 ? (
        <div
          role="group"
          aria-label={`Destinatarios: ${post.recipients.map((r) => r.name).join(", ")}`}
          className="mt-2.5 flex items-center"
        >
          {post.recipients.slice(0, 4).map((recipient, i) => (
            <span
              key={`${recipient.name}-${i}`}
              title={recipient.name}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-card font-display text-[11px] font-semibold ${
                i > 0 ? "-ml-2" : ""
              }`}
              style={{ backgroundColor: recipient.avatarBg, color: recipient.avatarColor }}
            >
              {recipient.initials}
            </span>
          ))}
          {post.recipients.length > 4 ? (
            <span className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#EFE6D9] font-display text-[11px] font-bold text-muted">
              +{post.recipients.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2.5 text-[15.5px] leading-[1.55] text-ink-soft">{post.body}</p>

      {post.photos ? (
        <div
          className={`mt-3.5 grid ${post.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-2.5`}
        >
          {post.photos.map((photo, i) => (
            <div
              key={i}
              className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-photo"
            >
              <Image src={photo.src} alt="" fill unoptimized className="object-cover" />
            </div>
          ))}
        </div>
      ) : post.photo ? (
        <div className="mt-3.5 flex h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-dashed bg-photo text-[#B0A290]">
          <PhotoIcon />
          <span className="text-[13.5px]">{post.photo.label}</span>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-[18px] border-t border-line-soft pt-3.5">
        <button type="button" className="flex items-center gap-[7px] font-bold text-coral-dark">
          <HeartIcon />
          {post.likes}
        </button>
        <button type="button" className="flex items-center gap-[7px] font-bold text-muted">
          <CommentIcon />
          {post.comments}
        </button>
        <button type="button" className="ml-auto font-extrabold text-terracotta-deep">
          Editar
        </button>
      </div>
    </article>
  );
}