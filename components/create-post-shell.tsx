"use client";

/* eslint-disable jsx-a11y/role-supports-aria-props -- SPEC 07 exige aria-invalid en los grupos de pills */

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CloseIcon, PlusIcon } from "./icons";
import type { Post } from "@/lib/feed";
import type { PostType } from "@/lib/feed";
import { buildPost, validateDescription } from "@/lib/post-utils";
import { normalize } from "@/lib/kid-utils";
import type { Kid } from "@/lib/kids";

interface CreatePostShellProps {
  baseKids: Kid[];
  currentUser: { name: string; initials: string; role: string };
}

const KIDS_KEY = "opdaycare.kids.v1";
const POSTS_KEY = "opdaycare.posts.v1";
const MAX_PHOTOS = 4;

const TYPE_OPTIONS: { type: PostType; label: string; inactive: string; selected: string }[] = [
  {
    type: "comida",
    label: "Comida",
    inactive: "bg-badge-honey-bg text-badge-honey",
    selected: "bg-badge-honey text-white",
  },
  {
    type: "siesta",
    label: "Siesta",
    inactive: "bg-badge-lavender-bg text-badge-lavender",
    selected: "bg-badge-lavender text-white",
  },
  {
    type: "actividad",
    label: "Actividad",
    inactive: "bg-badge-blue-bg text-badge-blue",
    selected: "bg-badge-blue text-white",
  },
  {
    type: "logro",
    label: "Logro",
    inactive: "bg-badge-green-bg text-badge-green",
    selected: "bg-badge-green text-white",
  },
  {
    type: "animo",
    label: "Ánimo",
    inactive: "bg-badge-rose-bg text-badge-rose",
    selected: "bg-badge-rose text-white",
  },
  {
    type: "foto",
    label: "Foto",
    inactive: "bg-badge-coral-bg text-badge-coral",
    selected: "bg-badge-coral text-white",
  },
  {
    type: "anuncio",
    label: "Anuncio",
    inactive: "bg-badge-indigo-bg text-badge-indigo",
    selected: "bg-badge-indigo text-white",
  },
];

const SECTION_LABEL = "mb-[10px] text-xs font-extrabold tracking-[0.7px] text-muted";
const BASE_PILL =
  "rounded-full border-[1.5px] text-[14px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-coral";
const KID_PILL_UNSELECTED = "border-line bg-card text-sand";
const KID_PILL_SELECTED = "border-ink bg-ink text-white";
const WHOLE_UNSELECTED = "border-line bg-card text-sand";
const WHOLE_SELECTED = "border-ink bg-ink text-white";

export default function CreatePostShell({ baseKids }: CreatePostShellProps) {
  const router = useRouter();
  const [addedKids, setAddedKids] = useState<Kid[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [wholeRoom, setWholeRoom] = useState(false);
  const [type, setType] = useState<PostType | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [touchedRecipients, setTouchedRecipients] = useState(false);
  const [touchedType, setTouchedType] = useState(false);
  const [touchedDescription, setTouchedDescription] = useState(false);
  const [persistError, setPersistError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const paraGroupRef = useRef<HTMLDivElement>(null);
  const typeGroupRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(KIDS_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setAddedKids(parsed as Kid[]);
        }
      } catch {
        // localStorage deshabilitado: solo los niños del mock
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    paraGroupRef.current?.querySelector("button")?.focus();
  }, []);

  const kids = useMemo(() => {
    const baseSoles = baseKids.filter((kid) => kid.room === "Soles");
    const baseNames = new Set(baseSoles.map((kid) => normalize(kid.name)));
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const merged: Kid[] = [];
    for (const kid of [...addedKids, ...baseSoles]) {
      const key = normalize(kid.name);
      if (seenIds.has(kid.id) || seenNames.has(key)) continue;
      if (baseNames.has(key) && !baseSoles.some((base) => base.id === kid.id)) continue;
      seenIds.add(kid.id);
      seenNames.add(key);
      merged.push(kid);
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }, [addedKids, baseKids]);
  const firstNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const kid of kids) {
      const first = kid.name.split(" ")[0];
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    return counts;
  }, [kids]);
  const selectedKids = useMemo(
    () =>
      recipients
        .map((id) => kids.find((kid) => kid.id === id))
        .filter((kid): kid is Kid => Boolean(kid)),
    [recipients, kids],
  );

  const recipientError =
    touchedRecipients && recipients.length === 0 && !wholeRoom
      ? "Elegí al menos un destinatario"
      : null;
  const typeError = touchedType && type === null ? "Elegí un tipo" : null;
  const descriptionError = touchedDescription ? validateDescription(description) : null;
  const valid =
    type !== null &&
    (recipients.length > 0 || wholeRoom) &&
    validateDescription(description) === null;

  function markAllTouched() {
    setTouchedRecipients(true);
    setTouchedType(true);
    setTouchedDescription(true);
  }

  function focusFirstError() {
    if (!type) {
      typeGroupRef.current?.querySelector("button")?.focus();
      return;
    }
    if (recipients.length === 0 && !wholeRoom) {
      paraGroupRef.current?.querySelector("button")?.focus();
      return;
    }
    if (description.trim() === "") {
      descriptionRef.current?.focus();
    }
  }

  function handleParaBlur(event: FocusEvent<HTMLDivElement>) {
    const related = event.relatedTarget as HTMLElement | null;
    if (related && paraGroupRef.current?.contains(related)) return;
    setTouchedRecipients(true);
  }

  function handleTypeBlur(event: FocusEvent<HTMLDivElement>) {
    const related = event.relatedTarget as HTMLElement | null;
    if (related && typeGroupRef.current?.contains(related)) return;
    setTouchedType(true);
  }

  function toggleKid(id: string) {
    if (wholeRoom) return;
    setRecipients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleWholeRoom() {
    if (!wholeRoom) {
      setWholeRoom(true);
      setRecipients([]);
    } else {
      setWholeRoom(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS);
    event.target.value = "";
    if (files.length === 0) return;
    const readers = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    );
    Promise.all(readers)
      .then((dataUrls) => {
        setPhotos((prev) => [...prev, ...dataUrls].slice(0, MAX_PHOTOS));
      })
      .catch(() => {
        // archivo ilegible: se ignora
      });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFormKeyDown(event: ReactKeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const el = event.target as HTMLElement;
    if (
      el.tagName === "TEXTAREA" ||
      el.tagName === "INPUT" ||
      el.tagName === "BUTTON" ||
      el.tagName === "A"
    ) {
      return;
    }
    if (!valid) markAllTouched();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) {
      markAllTouched();
      focusFirstError();
      return;
    }
    const post = buildPost({
      type: type as PostType,
      recipients: selectedKids.map((kid) => ({
        name: kid.name,
        initials: kid.initials,
        avatarBg: kid.avatarBg,
        avatarColor: kid.avatarColor,
      })),
      wholeRoom,
      description,
      photos: photos.length > 0 ? photos : undefined,
    });
    try {
      let stored: Post[] = [];
      const raw = window.localStorage.getItem(POSTS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) stored = parsed as Post[];
      }
      window.localStorage.setItem(POSTS_KEY, JSON.stringify([post, ...stored]));
      setPersistError(false);
      router.push("/");
    } catch {
      setPersistError(true);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
      className="w-full max-w-[580px] overflow-hidden rounded-3xl border border-line bg-[#FBF4EC] shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
    >
      <header className="flex items-center justify-between border-b border-line px-[26px] py-5">
        <Link href="/" className="text-[15px] font-bold text-muted">
          Cancelar
        </Link>
        <span className="font-display text-[18px] font-semibold text-ink">
          Nueva publicación
        </span>
        <button
          type="submit"
          disabled={!valid}
          className="text-[15px] font-extrabold text-terracotta disabled:cursor-not-allowed disabled:opacity-40"
        >
          Publicar
        </button>
      </header>

      <div className="px-[26px] pb-[26px] pt-6">
        <section className="mb-[22px]">
          <h2 id="label-para" className={SECTION_LABEL}>
            PARA
          </h2>
          <div
            ref={paraGroupRef}
            role="group"
            aria-labelledby="label-para"
            aria-invalid={!!recipientError}
            aria-describedby={recipientError ? "err-para" : undefined}
            onBlur={handleParaBlur}
            className="flex flex-wrap gap-[9px]"
          >
            {kids.map((kid) => {
              const selected = recipients.includes(kid.id);
              const first = kid.name.split(" ")[0];
              const label =
                (firstNameCounts.get(first) ?? 0) > 1 ? kid.name : first;
              return (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => toggleKid(kid.id)}
                  disabled={wholeRoom}
                  aria-pressed={selected}
                  aria-label={kid.name}
                  aria-invalid={!!recipientError}
                  aria-describedby={recipientError ? "err-para" : undefined}
                  className={`${BASE_PILL} flex items-center gap-2 py-[6px] pl-[6px] pr-[14px] disabled:cursor-not-allowed disabled:opacity-[0.4] ${
                    selected ? KID_PILL_SELECTED : KID_PILL_UNSELECTED
                  }`}
                >
                  <span
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full font-display text-[13px] font-semibold"
                    style={{ backgroundColor: kid.avatarBg, color: kid.avatarColor }}
                  >
                    {kid.initials}
                  </span>
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={toggleWholeRoom}
              aria-pressed={wholeRoom}
              className={`${BASE_PILL} px-4 py-[6px] ${
                wholeRoom ? WHOLE_SELECTED : WHOLE_UNSELECTED
              }`}
            >
              Toda la sala
            </button>
          </div>
          {recipientError ? (
            <p
              id="err-para"
              role="alert"
              className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
            >
              {recipientError}
            </p>
          ) : null}
        </section>

        <section className="mb-[22px]">
          <h2 id="label-type" className={SECTION_LABEL}>
            TIPO
          </h2>
          <div
            ref={typeGroupRef}
            role="group"
            aria-labelledby="label-type"
            aria-invalid={!!typeError}
            aria-describedby={typeError ? "err-type" : undefined}
            onBlur={handleTypeBlur}
            className="flex flex-wrap gap-[9px]"
          >
            {TYPE_OPTIONS.map((option) => {
              const selected = type === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setType(option.type)}
                  aria-pressed={selected}
                  aria-invalid={!!typeError}
                  aria-describedby={typeError ? "err-type" : undefined}
                  className={`rounded-full px-4 py-2 text-[13.5px] font-extrabold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-coral ${
                    selected ? option.selected : option.inactive
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {typeError ? (
            <p
              id="err-type"
              role="alert"
              className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
            >
              {typeError}
            </p>
          ) : null}
        </section>

        <section className="mb-[22px]">
          <h2 id="label-description" className={SECTION_LABEL}>
            DESCRIPCIÓN
          </h2>
          <textarea
            ref={descriptionRef}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => setTouchedDescription(true)}
            placeholder="Contá cómo le fue hoy…"
            aria-invalid={!!descriptionError}
            aria-describedby={descriptionError ? "err-description" : undefined}
            className={`min-h-[120px] w-full resize-y rounded-[14px] border-[1.5px] bg-white px-4 py-4 text-[15px] leading-normal text-ink outline-none placeholder:text-[#B6A99B] focus:border-coral ${
              descriptionError
                ? "border-[#E8B4A8] bg-[#FFF5F3] focus:border-[#E8B4A8]"
                : "border-[#EADFD0]"
            }`}
          />
          {descriptionError ? (
            <p
              id="err-description"
              role="alert"
              className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
            >
              {descriptionError}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className={SECTION_LABEL}>FOTOS</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFiles}
            className="hidden"
          />
          <div className="flex flex-wrap gap-3">
            {photos.map((dataUrl, index) => (
<div
                  key={`${dataUrl.slice(0, 32)}-${index}`}
                  className="relative h-24 w-24 overflow-hidden rounded-[14px] border border-line bg-photo"
                >
                  <Image
                    src={dataUrl}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label="Quitar foto"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <button
                type="button"
                onClick={openFilePicker}
                className="flex h-24 w-24 flex-col items-center justify-center gap-[6px] rounded-[14px] border-[1.5px] border-dashed border-line-dashed bg-photo text-[#B0A290] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-coral"
              >
                <PlusIcon className="text-terracotta-deep" />
                <span className="text-[12px]">Agregar</span>
              </button>
            ) : null}
          </div>
          {persistError ? (
            <p
              role="alert"
              className="mt-2 text-[12px] font-semibold leading-snug text-terracotta"
            >
              No se pudo guardar la publicación. Probá con menos fotos.
            </p>
          ) : null}
        </section>
      </div>
    </form>
  );
}