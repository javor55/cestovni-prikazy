import { sniff } from './detect.js';

/** Zkontroluje obrázek podpisu: musí to být PNG; průhledné pozadí se doporučuje. */
export async function checkSignature(file: File): Promise<{ error?: string; transparent: boolean }> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (sniff(head) !== 'image/png') return { error: 'Obrázek podpisu musí být ve formátu PNG.', transparent: false };
  if (file.size > 2 * 1024 * 1024) return { error: 'Obrázek podpisu je příliš velký (nejvýše 2 MB).', transparent: false };
  const bmp = await createImageBitmap(file);
  try {
    const c = document.createElement('canvas');
    c.width = Math.min(bmp.width, 400);
    c.height = Math.max(1, Math.round((bmp.height * c.width) / bmp.width));
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let transparent = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 250) {
        transparent = true;
        break;
      }
    }
    return { transparent };
  } finally {
    bmp.close();
  }
}
