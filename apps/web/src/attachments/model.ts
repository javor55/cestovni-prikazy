/** vehicle = doklad k soukromému vozidlu (TP, výpis z registru), signed = strana podepsaného skenu, signature = obrázek podpisu (PNG). */
export type AttachmentKind = 'accounting' | 'payment' | 'supporting' | 'vehicle' | 'signed' | 'signature';

/** Druhy dokladů, které se přiřazují k výdajům a cestě (bez podpisu). */
export const documentKinds = ['accounting', 'payment', 'supporting'] as const;
export type AttachmentMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic';

/** Ořez v poměrných souřadnicích (0–1) vůči obrázku po otočení. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Attachment {
  id: string;
  tripId: string;
  /** null = doplňující dokument k celé cestě (program, pozvánka…). */
  expenseId: string | null;
  kind: AttachmentKind;
  subtype: string;
  originalName: string;
  mime: AttachmentMime;
  size: number;
  sha256: string;
  order: number;
  createdAt: string;
  /** Otočení zadané uživatelem (po automatické opravě podle EXIF). */
  rotation: 0 | 90 | 180 | 270;
  crop: Crop | null;
  /** Stav převodu na variantu pro PDF: hotovo / nepodařilo se (originál zůstává). */
  conversion: 'done' | 'failed';
  conversionError?: string;
  pages: number;
}

export type BlobVariant = 'original' | 'derived' | 'thumbnail';

export interface StoredBlob {
  /** `${attachmentId}:${variant}` */
  key: string;
  attachmentId: string;
  variant: BlobVariant;
  blob: Blob;
}

export const kindLabels: Record<AttachmentKind, string> = {
  accounting: 'Účetní doklad',
  payment: 'Doklad o zaplacení',
  supporting: 'Doplňující dokument',
  vehicle: 'Doklad k vozidlu',
  signed: 'Podepsaný dokument',
  signature: 'Obrázek podpisu',
};

export const subtypes: Record<AttachmentKind, string[]> = {
  accounting: ['Účtenka', 'Faktura', 'Jízdenka', 'Parkovací lístek', 'Doklad o ubytování', 'Doklad o dálniční známce', 'Jiný účetní doklad'],
  payment: ['Potvrzení karetní platby', 'Potvrzení z internetového bankovnictví', 'Výpis konkrétní transakce', 'Potvrzení platební brány', 'Pokladní doklad', 'Jiné potvrzení'],
  supporting: ['Rezervace', 'Objednávka', 'Program cesty', 'Pozvánka', 'Vysvětlení chybějícího dokladu', 'Jiný dokument'],
  vehicle: ['Technický průkaz', 'Výpis z registru vozidel', 'Smlouva o výpůjčce vozidla', 'Jiný doklad k vozidlu'],
  signed: [],
  signature: [],
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TRIP_BYTES = 300 * 1024 * 1024;
