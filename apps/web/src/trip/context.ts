import { createContext, useContext } from 'react';
import type { CalculationResult, Issue } from '@cp/core';
import type { DocCounts, Mapped } from '../model/toInput.js';
import type { TripDoc } from '../model/trip.js';

export interface TripCtx {
  trip: TripDoc;
  /** Změní cestu; uložení do prohlížeče proběhne automaticky. */
  update: (fn: (draft: TripDoc) => void) => void;
  mapped: Mapped;
  result?: CalculationResult;
  /** Chyby formuláře + výsledek kontrol výpočtu. */
  issues: Issue[];
  /** Počty dokladů k výdajům a celkový počet příloh cesty. */
  docCounts: DocCounts;
  attachmentCount: number;
}

export const TripContext = createContext<TripCtx | null>(null);

export function useTrip(): TripCtx {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip mimo TripContext');
  return ctx;
}
