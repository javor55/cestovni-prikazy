import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './controls.js';

/** Potvrzovací dialog nad nativním <dialog>: zachytí fokus, Esc zavře. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-danger-line bg-white p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        <div className="text-[15px] leading-relaxed text-muted">{children}</div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Zrušit
          </Button>
          <Button variant="dangerSolid" className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
