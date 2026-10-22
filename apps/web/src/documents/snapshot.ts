import type { DocModel, DocPart } from '@cp/documents/model';
import type { DocCounts } from '../model/toInput.js';
import type { TripDoc } from '../model/trip.js';

/** Neměnný snímek dokumentu: z něj se PDF vždy vytvoří stejně, i když se později změní data nebo sazby. */
export interface Snapshot {
  id: string;
  tripId: string;
  createdAt: string;
  /** Vzhled ze starších verzí (moderní / konzervativní). Dnes je jen jeden vzhled, hodnota se nepoužívá. */
  layout?: 'modern' | 'conservative';
  part: DocPart;
  /** Otisk vstupních údajů – podle něj aplikace pozná, že se cesta od vytvoření PDF změnila. */
  inputHash: string;
  model: DocModel;
}

/** Otisk údajů cesty, které ovlivňují dokument (bez id a časových razítek – po importu projektu se nemění). */
export async function inputHash(trip: TripDoc, docCounts: DocCounts): Promise<string> {
  const { id: _i, updatedAt: _u, lastOpenedAt: _l, ...rest } = trip;
  const data = new TextEncoder().encode(JSON.stringify([rest, docCounts]));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
