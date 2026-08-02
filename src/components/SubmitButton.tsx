"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "btn-primary ring-focus rounded-md px-4 py-2 text-sm disabled:opacity-60"
      }
    >
      {pending ? pendingText ?? "Procesando…" : children}
    </button>
  );
}
