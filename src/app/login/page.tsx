"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { useSearchParams } from "next/navigation";
import { brand } from "@/lib/brand";

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/reports";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div>
        <label className="block text-sm font-medium text-ink">Correo</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field ring-focus mt-1 w-full px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field ring-focus mt-1 w-full px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary ring-focus w-full rounded-md px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-card w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl text-ink">{brand.platformName}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Acceso para consultores y revisores ministeriales.
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--faint)" }}>
          Herramienta provista por {brand.providerShort}
        </p>

        {/* useSearchParams() requiere Suspense en el build de producción. */}
        <Suspense fallback={<div className="mt-6 h-40" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
