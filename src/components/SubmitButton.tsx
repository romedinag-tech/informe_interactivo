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
        "rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      }
    >
      {pending ? pendingText ?? "Procesando…" : children}
    </button>
  );
}
