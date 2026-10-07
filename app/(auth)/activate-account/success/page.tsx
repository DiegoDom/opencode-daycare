import Link from "next/link";

import { LogoIcon } from "@/components/icons";

export default function ActivationSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF4EC] p-10">
      <div className="w-full max-w-[440px] text-center">
        <div className="mb-[22px] flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-[linear-gradient(155deg,#F8C3A8,#F2937A)] shadow-[0_12px_26px_-10px_rgba(238,129,100,0.65)]">
          <LogoIcon className="h-[30px] w-[30px] text-white" />
        </div>

        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#D9F0E0]">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3E8B62"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="font-display text-[30px] font-semibold leading-[1.15] text-ink">
          Cuenta activada
        </h1>
        <p className="mx-auto mb-8 mt-2 max-w-[340px] text-[15.5px] leading-[1.55] text-muted">
          Tu cuenta fue activada y ya podés seguir el día de tu hijo desde donde
          estés.
        </p>

        <Link
          href="/"
          className="block w-full cursor-pointer rounded-[15px] bg-gradient-to-b from-peach to-coral py-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
        >
          Ir a mi cuenta
        </Link>
      </div>
    </div>
  );
}