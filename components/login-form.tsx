export default function LoginForm() {
  return (
    <div>
      <h2 className="mb-[6px] font-display text-[30px] font-semibold text-ink">
        Iniciar sesión
      </h2>
      <p className="mb-7 text-[15px] text-muted">Ingresá para ver el día de hoy.</p>

      <div className="mb-[9px] text-[12px] font-bold tracking-[0.7px] text-muted">
        EMAIL
      </div>
      <input
        type="email"
        defaultValue="caro@opendaycare.com"
        aria-label="Correo electrónico"
        className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-line bg-white px-4 py-[14px] text-[15px] text-ink placeholder:text-[#B6A99B]"
      />

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        CONTRASEÑA
      </div>
      <input
        type="password"
        placeholder="••••••••"
        aria-label="Contraseña"
        className="mb-[10px] w-full rounded-[14px] border-[1.5px] border-line bg-white px-4 py-[14px] text-[15px] text-ink placeholder:text-[#B6A99B]"
      />

      <div className="mb-5 text-right">
        <button
          type="button"
          className="cursor-pointer text-[13.5px] font-bold text-terracotta-deep"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <button
        type="button"
        className="block w-full cursor-pointer rounded-[15px] bg-gradient-to-b from-peach to-coral py-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
      >
        Iniciar sesión
      </button>

      <p className="mt-6 text-center text-[14.5px] text-muted">
        ¿Te invitó la guardería?{" "}
        <button
          type="button"
          className="cursor-pointer font-extrabold text-terracotta-deep"
        >
          Activá tu cuenta
        </button>
      </p>
    </div>
  );
}