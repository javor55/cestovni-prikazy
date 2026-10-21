import { useState } from 'react';
import { formatDay } from '../model/format.js';
import { fetchCnbRate, type CnbRate } from './cnb.js';

/** Tlačítko „Načíst kurz ČNB“ s hlášením výsledku nebo chyby. */
export function CnbButton({ date, currency, onRate, rateDate }: { date: string; currency: string; onRate: (r: CnbRate) => void; rateDate?: string }) {
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={state.busy}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg border border-accent-line bg-white px-3 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
        onClick={async () => {
          setState({ busy: true });
          try {
            onRate(await fetchCnbRate(date, currency));
            setState({});
          } catch (e) {
            setState({ error: (e as Error).message });
          }
        }}
      >
        {state.busy ? 'Načítám kurz…' : `Načíst kurz ČNB${date ? ` k ${formatDay(date)}` : ''}`}
      </button>
      {state.error && (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {state.error}
        </p>
      )}
      {!state.error && rateDate && <p className="text-[13px] text-subtle">Kurzovní lístek ČNB ze dne {formatDay(rateDate)}.</p>}
    </div>
  );
}
