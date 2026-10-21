// Model dokumentu: všechny údaje už naformátované jako text. Šablony nic nepočítají a nic neformátují,
// takže stejný model (uložený snímek) dá vždy stejné PDF – i když se později změní sazby nebo kód výpočtu.

export const DOC_MODEL_VERSION = 1;

export type Layout = 'modern' | 'conservative';
/** full = cestovní příkaz + vyúčtování; A = jen cestovní příkaz k podpisu před cestou. */
export type DocPart = 'full' | 'A';

export interface Row {
  label: string;
  value: string;
}

export interface DocModel {
  version: number;
  number: string;
  /** Datum a čas vytvoření snímku, např. „21. 10. 2026 14:05“. */
  createdAt: string;
  ruleSet: string;
  issued: { place: string; date: string };

  employer: { name: string; ico: string; seat: string; unit: string; costCenter: string; project: string; sector: string };
  employee: { name: string; personalNumber: string; position: string; department: string; regularWorkplace: string; address: string };

  trip: {
    kind: string;
    purpose: string;
    startPlace: string;
    endPlace: string;
    plannedStart: string;
    plannedEnd: string;
    destinations: string;
    via: string;
    transport: string;
    advances: string[];
    note: string;
  };

  actual: { start: string; end: string; km: string };
  segments: { n: string; from: string; to: string; departure: string; arrival: string; transport: string; km: string; border: string }[];

  perDiem: {
    days: {
      date: string;
      domesticTime: string;
      foreignTime: string;
      /** Např. „5–12 h: 155,00 Kč − 1 × 70 %“ */
      domestic: string;
      domesticAmount: string;
      country: string;
      tier: string;
      base: string;
      tierAmount: string;
      meals: string;
      reduction: string;
      amount: string;
      pocketMoney: string;
    }[];
    domesticTotal: string;
    foreignTotal: string;
    reductionTotal: string;
    note: string;
    hasForeign: boolean;
  };

  expenses: {
    n: string;
    date: string;
    category: string;
    description: string;
    supplier: string;
    amount: string;
    rate: string;
    czk: string;
    payment: string;
    docs: string;
    note: string;
  }[];
  expensesNote: string;

  vehicle?: {
    vehicle: string;
    owner: string;
    fuel: string;
    consumption: string;
    km: string;
    basic: string;
    basicCalc: string;
    fuelComp: string;
    fuelCalc: string;
    fuelPriceSource: string;
    total: string;
    requested: string;
  };

  settlement: {
    rows: { label: string; foreign: string; czk: string }[];
    payoutLabel: string;
    payout: string;
    headline: Row[];
  };

  documentCount: string;
  declaration: string;
}

/** Název souboru podle zadání: CP-RRRR-NNNN_Cestovni-prikaz-a-zadost-o-vyplaceni.pdf */
export function fileName(model: Pick<DocModel, 'number'>, part: DocPart): string {
  const n = (model.number || 'CP').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '');
  return `${n}_${part === 'full' ? 'Cestovni-prikaz-a-zadost-o-vyplaceni' : 'Cestovni-prikaz'}.pdf`;
}
