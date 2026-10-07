"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";

import type { PrefilledValues } from "@/lib/activate";
import {
  createParentAccountAction,
  verifyActivationEmail,
  type CreateParentAccountState,
  type VerifyEmialActionState,
} from "@/lib/activate-actions";
import { activateLabels, activateInputs } from "@/lib/activation-strings";
import ActivateAccountForm, { type InvitationPreview } from "@/components/activate-account-form";

const INITIAL_STEP1: VerifyEmialActionState = { ok: false };
const INITIAL_STEP2: CreateParentAccountState = {};

interface ActivatePageProps {
  firstStep: boolean;
  prefilled: PrefilledValues;
  preview?: InvitationPreview;
}

export default function ActivatePage({
  firstStep,
  prefilled,
  preview,
}: ActivatePageProps) {
  const [step1State, step1Action, step1Pending] = useActionState(
    verifyActivationEmail,
    INITIAL_STEP1,
  );
  const [step2State, step2Action, step2Pending] = useActionState(
    createParentAccountAction,
    INITIAL_STEP2,
  );
  // El "deshacer" de los chips es la única transición con estado local; el paso
  // 1→2 y el "vuelve al ingreso de código" se derivan del estado de las actions.
  const [codeUndone, setCodeUndone] = useState(false);

  // Prefilled por el link (`?code=&email=`) salta directo al paso 2. Desde el
  // paso 1, el `ok` de `verifyActivationEmail` lo deriva a la vista de cuenta.
  const showCreateAccount = !firstStep || step1State.ok;
  const step2Email = step1State.email ?? prefilled.email ?? "";
  const step2Preview = step1State.preview ?? preview;
  const codeEditable =
    codeUndone || !prefilled.code || Boolean(step2State.error);

  if (!showCreateAccount) {
    return (
      <div>
        <h1 className="font-display text-[32px] font-semibold leading-[1.15] text-ink">
          {activateLabels.title}
        </h1>
        <p className="mb-[26px] mt-2 text-[15.5px] leading-[1.55] text-muted">
          {activateLabels.step1Subtitle}
        </p>

        <form action={step1Action} noValidate>
          <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
            {activateLabels.emailLabel}
          </div>
          <input
            name={activateInputs.email.name}
            type={activateInputs.email.type}
            defaultValue={prefilled.email}
            autoComplete={activateInputs.email.autoComplete}
            placeholder={activateInputs.email.placeholder}
            aria-label={activateLabels.emailLabel}
            className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] text-[15px] text-ink placeholder:text-[#B6A99B]"
          />

          {!step1State.ok && step1State.error && (
            <p
              role="alert"
              className="mb-4 rounded-[12px] bg-badge-coral-bg px-4 py-[11px] text-[13.5px] font-semibold text-badge-coral"
            >
              {step1State.error}
            </p>
          )}

          <button
            type="submit"
            disabled={step1Pending}
            aria-busy={step1Pending}
            className="block w-full cursor-pointer rounded-[15px] bg-gradient-to-b from-peach to-coral py-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)] disabled:cursor-progress disabled:opacity-70"
          >
            {activateLabels.step1Cta}
          </button>

          <p className="mt-[22px] text-center text-[14.5px] text-muted">
            {activateLabels.alreadyAccount}{" "}
            <Link
              href="/login"
              className="cursor-pointer font-extrabold text-terracotta-deep"
            >
              {activateLabels.login}
            </Link>
          </p>
        </form>
      </div>
    );
  }

  return (
    <ActivateAccountForm
      action={step2Action}
      pending={step2Pending}
      error={step2State.error}
      prefilled={{ code: prefilled.code, email: step2Email }}
      preview={step2Preview}
      codeEditable={codeEditable}
      onUndoCode={() => setCodeUndone(true)}
    />
  );
}