"use client";

import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmSubmit({
  triggerLabel,
  title,
  description,
  confirmLabel,
  disabled = false,
  destructive = false,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <Button
        type="button"
        variant={destructive ? "outline" : "default"}
        disabled={disabled}
        onClick={(event) => {
          if (event.currentTarget.form?.reportValidity() ?? true)
            dialog.current?.showModal();
        }}
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-[min(92vw,28rem)] rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="space-y-5 p-6">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm text-slate-600">
              {description}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => dialog.current?.close()}
            >
              Go back
            </Button>
            <Button type="submit" variant={destructive ? "outline" : "default"}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
