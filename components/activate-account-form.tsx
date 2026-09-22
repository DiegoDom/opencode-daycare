import Link from "next/link";

export default function ActivateAccountForm() {
  return (
    <div>
      <h1 className="font-display text-[32px] font-semibold leading-[1.15] text-ink">
        Bienvenida a OpenDayCare
      </h1>
      <p className="mb-[26px] mt-2 text-[15.5px] leading-[1.55] text-muted">
        Te invitaron a seguir el día de tu hijo. Creá tu contraseña para activar
        la cuenta.
      </p>

      <div className="mb-[22px] flex items-center gap-[14px] rounded-[16px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px]">
        <div className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-[#A9D9E8] font-display text-[19px] font-semibold text-[#1F7A93]">
          M
        </div>
        <div>
          <div className="text-[13px] text-muted">Te invitaron a seguir a</div>
          <div className="font-display text-[17px] font-semibold text-ink">
            Mateo · Sala Soles
          </div>
        </div>
      </div>

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        CÓDIGO DE INVITACIÓN
      </div>
      <input
        defaultValue="7K4P9"
        aria-label="Código de invitación"
        className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] font-display text-[18px] font-bold tracking-[3px] text-ink"
      />

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        EMAIL
      </div>
      <input
        type="email"
        defaultValue="lucia.fernandez@gmail.com"
        aria-label="Correo electrónico"
        className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] text-[15px] text-ink"
      />

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        CREAR CONTRASEÑA
      </div>
      <input
        type="password"
        defaultValue="contraseña"
        aria-label="Crear contraseña"
        className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#F2A78E] bg-white px-4 py-[14px] text-[15px] text-ink"
      />

      <div
        aria-label="Autorizo a la guardería a tomar y compartir fotos de mi hijo dentro de la app."
        className="mb-6 flex items-start gap-3 rounded-[14px] bg-[#FBF1D6] px-4 py-[14px]"
      >
        <span className="mt-[1px] flex h-6 w-6 flex-none items-center justify-center rounded-[8px] bg-[#5FB97E]">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="text-[14px] leading-[1.45] text-[#8A7234]">
          Autorizo a la guardería a tomar y compartir fotos de mi hijo dentro de
          la app.
        </span>
      </div>

      <button
        type="button"
        className="block w-full cursor-pointer rounded-[15px] bg-gradient-to-b from-peach to-coral py-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
      >
        Activar mi cuenta
      </button>

      <p className="mt-[22px] text-center text-[14.5px] text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/login"
          className="cursor-pointer font-extrabold text-terracotta-deep"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}