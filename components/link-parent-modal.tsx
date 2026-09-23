"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CloseIcon } from "./icons";
import {
  generateInviteCode,
  validateParentEmail,
  validateParentName,
} from "@/lib/kid-validation";

export interface LinkParentDraft {
  name: string;
  email: string;
  role: ParentRole;
}

const ROLES = ["Mamá", "Papá", "Tutor/a"] as const;
type ParentRole = (typeof ROLES)[number];

interface LinkParentModalProps {
  kidName: string;
  onClose: () => void;
  onSave: (draft: LinkParentDraft) => void;
}

const inputBase =
  "w-full rounded-[14px] border-[1.5px] bg-white px-4 py-[13px] text-[15px] text-ink outline-none placeholder:text-[#B6A99B] focus:border-coral";
const inputDefault = "border-[#EADFD0]";
const inputError = "border-[#E8B4A8] bg-[#FFF5F3] focus:border-[#E8B4A8]";

export default function LinkParentModal({ kidName, onClose, onSave }: LinkParentModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ParentRole>("Mamá");
  const [touchedName, setTouchedName] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [inviteCode] = useState(generateInviteCode);

  const nameError = touchedName ? validateParentName(name) : undefined;
  const emailError = touchedEmail ? validateParentEmail(email) : undefined;
  const valid =
    validateParentName(name) === null && validateParentEmail(email) === null;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) {
      setTouchedName(true);
      setTouchedEmail(true);
      return;
    }
    onSave({ name: name.trim(), email: email.trim(), role });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 md:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={`Vincular padre a ${kidName}`}
        className="flex max-h-[min(85dvh,720px)] w-[min(480px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-line bg-[#FBF4EC] shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <header className="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-line bg-[#FBF4EC] px-5 py-[18px] md:px-[26px]">
          <div className="min-w-0 pr-2">
            <div className="truncate font-display text-[18px] font-semibold leading-tight text-ink">
              Vincular padre
            </div>
            <div className="truncate text-[13px] text-faint">a {kidName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-[#F0E6D8] text-[#94887B] hover:text-ink"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-[26px]">
          <div className="mb-5 flex gap-[11px] rounded-[14px] bg-[#E3ECFB] px-4 py-[13px]">
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4E72C8"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-[1px] flex-none"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span className="text-[13.5px] leading-[1.45] text-[#3F5694]">
              Le enviaremos un correo con un código para que active su cuenta. Solo verá el feed de{" "}
              {kidName}.
            </span>
          </div>

          <div className="mb-[18px]">
            <label
              htmlFor="parent-name"
              className="mb-2 block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              NOMBRE DEL PADRE/MADRE
            </label>
            <input
              id="parent-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouchedName(true)}
              placeholder="Ej. Diego Fernández"
              autoComplete="off"
              autoFocus
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "err-parent-name" : undefined}
              className={`${inputBase} ${nameError ? inputError : inputDefault}`}
            />
            {nameError ? (
              <p
                id="err-parent-name"
                role="alert"
                className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
              >
                {nameError}
              </p>
            ) : (
              <p className="mt-1.5 hidden text-[12px] leading-none" aria-hidden="true">
                &nbsp;
              </p>
            )}
          </div>

          <div className="mb-[18px]">
            <label
              htmlFor="parent-email"
              className="mb-2 block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              EMAIL
            </label>
            <input
              id="parent-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouchedEmail(true)}
              placeholder="correo@ejemplo.com"
              autoComplete="off"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "err-parent-email" : undefined}
              className={`${inputBase} ${emailError ? inputError : inputDefault}`}
            />
            {emailError ? (
              <p
                id="err-parent-email"
                role="alert"
                className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
              >
                {emailError}
              </p>
            ) : null}
          </div>

          <div className="mb-5">
            <div className="mb-[10px] text-[12px] font-extrabold tracking-[0.7px] text-muted">
              PARENTESCO
            </div>
            <div className="flex gap-[9px]" role="radiogroup" aria-label="Parentesco">
              {ROLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={role === option}
                  onClick={() => setRole(option)}
                  className={`flex-1 rounded-full border-[1.5px] px-2 py-[11px] text-[14px] font-extrabold ${
                    role === option
                      ? "border-[#9FB8EC] bg-[#CCD8F4] text-[#4E72C8]"
                      : "border-[#ECE0D0] bg-[#FFFDF9] text-[#6E6359]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 rounded-[16px] border-[1.5px] border-dashed border-[#E6D08A] bg-[#FBF1D6] px-4 py-[18px] text-center">
            <div className="mb-2 text-[12px] font-extrabold tracking-[0.7px] text-[#A88526]">
              CÓDIGO DE INVITACIÓN
            </div>
            <div className="font-display text-[34px] font-semibold tracking-[7px] text-[#8A7234]">
              {inviteCode}
            </div>
            <div className="mt-[6px] text-[13px] text-[#A88526]">Vence en 7 días</div>
          </div>

          <button
            type="submit"
            disabled={!valid}
            className="flex w-full items-center justify-center gap-[9px] rounded-[14px] px-4 py-[14px] text-[15.5px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(180deg,#F4977E,#EE8164)" }}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4z" />
              <path d="M22 2 11 13" />
            </svg>
            Enviar invitación
          </button>
        </div>
      </form>
    </div>
  );
}