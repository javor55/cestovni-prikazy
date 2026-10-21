// Načtení kurzu ČNB přes server aplikace. Server dostane jen datum, nic o cestě ani uživateli.

export interface CnbRate {
  /** Kurz v Kč za `amount` jednotek, desetinná tečka. */
  rate: string;
  amount: number;
  /** Datum kurzovního lístku – u víkendu a svátku předchozí pracovní den. */
  rateDate: string;
}

interface CnbResponse {
  date: string;
  rates: Record<string, { rate: string; amount: number }>;
  error?: string;
}

const cache = new Map<string, Promise<CnbResponse>>();

export class RateError extends Error {}

export async function fetchCnbRate(date: string, currency: string): Promise<CnbRate> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RateError('Nejdřív zadejte datum.');
  let p = cache.get(date);
  if (!p) {
    p = fetch(`/api/kurzy?datum=${date}`).then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as CnbResponse;
      if (!res.ok) throw new RateError(body.error ?? 'Kurz ČNB se nepodařilo načíst. Zadejte ho ručně podle cnb.cz.');
      return body;
    });
    cache.set(date, p);
    p.catch(() => cache.delete(date));
  }
  let body: CnbResponse;
  try {
    body = await p;
  } catch (e) {
    throw e instanceof RateError ? e : new RateError('Kurz ČNB se nepodařilo načíst (jste offline?). Zadejte ho ručně podle cnb.cz.');
  }
  const r = body.rates[currency];
  if (!r) throw new RateError(`ČNB pro měnu ${currency} kurz nevyhlašuje. Zadejte kurz ručně.`);
  return { rate: r.rate, amount: r.amount, rateDate: body.date };
}
