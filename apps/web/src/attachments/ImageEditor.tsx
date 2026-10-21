import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Button } from '../ui/controls.js';
import type { Attachment, Crop } from './model.js';
import { rotatedPreview } from './render.js';
import { editImage, getBlob } from './store.js';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';
const MIN = 0.08;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Otočení po 90° a ořez tažením rohů. Ukládá jen parametry; originál zůstává beze změny. */
export function ImageEditor({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Crop } | null>(null);
  const [rotation, setRotation] = useState(attachment.rotation);
  const [crop, setCrop] = useState<Crop>(attachment.crop ?? { x: 0, y: 0, w: 1, h: 1 });
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let alive = true;
    let made: string | undefined;
    void getBlob(attachment.id, 'original').then(async (b) => {
      if (!b || !alive) return;
      made = await rotatedPreview(b, { mime: attachment.mime, rotation });
      if (alive) setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [attachment.id, attachment.mime, rotation]);

  const rotate = (dir: 1 | -1) => {
    setRotation((r) => (((r + dir * 90 + 360) % 360) as Attachment['rotation']));
    // Ořez se otočí spolu s obrázkem.
    setCrop((c) => (dir === 1 ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w }));
  };

  const onDown = (handle: Handle) => (e: RPointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, start: crop };
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    const box = area.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.x) / box.width;
    const dy = (e.clientY - d.y) / box.height;
    const s = d.start;
    let { x, y, w, h } = s;
    if (d.handle === 'move') {
      x = clamp(s.x + dx, 0, 1 - s.w);
      y = clamp(s.y + dy, 0, 1 - s.h);
    } else {
      if (d.handle.includes('w')) {
        x = clamp(s.x + dx, 0, s.x + s.w - MIN);
        w = s.x + s.w - x;
      }
      if (d.handle.includes('e')) w = clamp(s.w + dx, MIN, 1 - s.x);
      if (d.handle.includes('n')) {
        y = clamp(s.y + dy, 0, s.y + s.h - MIN);
        h = s.y + s.h - y;
      }
      if (d.handle.includes('s')) h = clamp(s.h + dy, MIN, 1 - s.y);
    }
    setCrop({ x, y, w, h });
  };

  const full = crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1;
  const pct = (v: number) => `${v * 100}%`;
  const corner = 'absolute size-11 -translate-x-1/2 -translate-y-1/2 touch-none flex items-center justify-center';

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label="Úprava dokladu"
      className="m-auto h-[min(100dvh,56rem)] max-h-dvh w-[min(100vw,48rem)] max-w-full bg-ink p-0 text-white backdrop:bg-black/70 sm:rounded-2xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex grow items-center justify-center overflow-hidden p-6">
          {url ? (
            <div ref={area} className="relative inline-block max-h-full select-none" onPointerMove={onMove} onPointerUp={() => (drag.current = null)}>
              <img src={url} alt="Náhled dokladu" className="block max-h-[calc(min(100dvh,56rem)-11rem)] max-w-full" draggable={false} />
              <div
                className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
                onPointerDown={onDown('move')}
                aria-hidden="true"
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                <div
                  key={h}
                  className={corner}
                  style={{ left: pct(h.includes('w') ? crop.x : crop.x + crop.w), top: pct(h.includes('n') ? crop.y : crop.y + crop.h) }}
                  onPointerDown={onDown(h)}
                  aria-hidden="true"
                >
                  <span className="size-4 rounded-full border-2 border-ink bg-white" />
                </div>
              ))}
            </div>
          ) : (
            <p>Načítám…</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/15 p-3">
          <Button variant="secondary" onClick={() => rotate(-1)} aria-label="Otočit doleva">
            ⟲ Otočit
          </Button>
          <Button variant="secondary" onClick={() => rotate(1)} aria-label="Otočit doprava">
            ⟳ Otočit
          </Button>
          <Button variant="secondary" disabled={full} onClick={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })}>
            Zrušit ořez
          </Button>
          <span className="grow" />
          <Button variant="secondary" onClick={onClose}>
            Zavřít
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await editImage(attachment.id, { rotation, crop: full ? null : crop });
              onClose();
            }}
          >
            {busy ? 'Ukládám…' : 'Uložit'}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
