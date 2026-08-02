"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { useSearchParams } from "next/navigation";

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
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy focus:outline-none"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-navy">Informes Interactivos</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Acceso para consultores y revisores ministeriales.
        </p>

        {/* useSearchParams() requiere Suspense en el build de producción. */}
        <Suspense fallback={<div className="mt-6 h-40" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
