// Fiktivní ukázková cesta pro návrh dokumentů (etapa 3).
// Sazby a kurzy jsou ILUSTRATIVNÍ – nejde o ověřené hodnoty z vyhlášek ani z ČNB.
// Výpočet je zjednodušený a slouží jen k naplnění šablon konzistentními čísly;
// skutečné výpočetní jádro vznikne v milníku 1.

const r2 = (n: number) => Math.round(n * 100) / 100;

export const ruleSet = {
  id: 'CZ-2026-podnikatelska',
  version: '0.0-ukazka',
  label: 'Ilustrativní sazby (UKÁZKA – neověřeno)',
};

export const trip = {
  number: 'CP-2026-0042',
  purpose: 'Jednání s dodavatelem o technických podmínkách dodávky',
  kind: 'Zahraniční' as const,
  sector: 'Podnikatelská sféra',
  issuedPlace: 'Praha',
  issuedDate: '12. 10. 2026',
  employee: {
    name: 'Jana Ukázková',
    personalNumber: '1042',
    position: 'Nákupní specialistka',
    department: 'Nákup',
    regularWorkplace: 'Praha, Ukázková 12',
  },
  employer: {
    name: 'Ukázková firma s.r.o.',
    ico: '00000000',
    seat: 'Ukázková 12, 110 00 Praha 1',
    costCenter: 'NS-210',
    project: 'Z-2026-117',
  },
  plan: {
    start: '14. 10. 2026 06:30',
    end: '16. 10. 2026 19:00',
    startPlace: 'Praha',
    endPlace: 'Praha',
    destinations: 'Vídeň (Rakousko)',
    via: 'Brno, Mikulov / Drasenhofen',
    transport: 'Soukromé osobní vozidlo (na žádost zaměstnavatele)',
  },
  actual: { start: '14. 10. 2026 06:30', end: '16. 10. 2026 18:30' },
};

export const segments = [
  { n: 1, from: 'Praha (CZ)', to: 'Vídeň (AT)', dep: '14. 10. 06:30', arr: '14. 10. 11:00', transport: 'Soukromé vozidlo', km: 334, border: 'Mikulov / Drasenhofen 14. 10. 09:45' },
  { n: 2, from: 'Vídeň (AT)', to: 'Vídeň (AT)', dep: '15. 10. 08:00', arr: '15. 10. 18:00', transport: 'Soukromé vozidlo, MHD', km: 18, border: '' },
  { n: 3, from: 'Vídeň (AT)', to: 'Praha (CZ)', dep: '16. 10. 14:00', arr: '16. 10. 18:30', transport: 'Soukromé vozidlo', km: 334, border: 'Drasenhofen / Mikulov 16. 10. 15:15' },
];

// Krácení zahraničního stravného za bezplatné jídlo podle délky pobytu v zahraničí
// (pásmo nad 18 h = 25 %, 12–18 h = 35 %, do 12 h = 70 % z částky pásma). K potvrzení: Ú-17.
// Výsledky odpovídají testu výpočetního jádra packages/core/test/foreign.test.ts.
const foreignBase = 45; // EUR, Rakousko – ILUSTRATIVNÍ
const days = [
  { date: 'St 14. 10. 2026', czTime: '3 h 15 min', abroadTime: '14 h 15 min', band: '12–18 h = 2/3', share: 2 / 3, cut: 0.35, meals: { b: false, l: false, d: false } },
  { date: 'Čt 15. 10. 2026', czTime: '0 h', abroadTime: '24 h 00 min', band: 'nad 18 h = 1/1', share: 1, cut: 0.25, meals: { b: true, l: true, d: false } },
  { date: 'Pá 16. 10. 2026', czTime: '3 h 15 min', abroadTime: '15 h 15 min', band: '12–18 h = 2/3', share: 2 / 3, cut: 0.35, meals: { b: true, l: false, d: false } },
];

export const perDiem = days.map((d) => {
  const base = r2(foreignBase * d.share);
  const freeMeals = [d.meals.b, d.meals.l, d.meals.d].filter(Boolean).length;
  const reduction = r2(base * d.cut * freeMeals);
  const beforeRounding = Math.max(0, r2(base - reduction));
  const result = Math.ceil(beforeRounding); // návrh Ú-8: na celé EUR nahoru
  return {
    ...d,
    country: 'Rakousko',
    baseRate: foreignBase,
    base,
    freeMeals,
    reductionLabel: freeMeals ? `${freeMeals} × ${Math.round(d.cut * 100)} %` : '–',
    reduction,
    beforeRounding,
    result,
    currency: 'EUR',
    domestic: 0, // doba v ČR v daném dni < 5 h = tuzemské stravné nenáleží (Ú-5)
  };
});

export const advance = { amount: 100, currency: 'EUR', providedOn: '12. 10. 2026', rate: 24.35, rateSource: 'ČNB ke dni poskytnutí zálohy' };

type Expense = {
  n: number;
  category: string;
  description: string;
  supplier: string;
  date: string;
  amount: number;
  currency: string;
  rate: number;
  rateSource: string;
  czk: number;
  payment: string;
  payer: 'Zaměstnanec' | 'Záloha' | 'Zaměstnavatel';
  reimbursable: boolean;
  docs: { accounting: string[]; payment: string[] };
  note?: string;
};

export const expenses: Expense[] = [
  { n: 1, category: 'Ubytování', description: '2 noci vč. snídaně', supplier: 'Hotel Ukázka Wien', date: '16. 10. 2026', amount: 238, currency: 'EUR', rate: r2((5812.44 / 238) * 10000) / 10000, rateSource: 'Potvrzení banky', czk: 5812.44, payment: 'Soukromá karta', payer: 'Zaměstnanec', reimbursable: true, docs: { accounting: ['Faktura 2026-8812'], payment: ['Výpis transakce z bankovnictví'] } },
  { n: 2, category: 'Parkovné', description: 'Hotelová garáž, 2 noci', supplier: 'Hotel Ukázka Wien', date: '16. 10. 2026', amount: 36, currency: 'EUR', rate: advance.rate, rateSource: 'Kurz zálohy', czk: r2(36 * advance.rate), payment: 'Hotovost ze zálohy', payer: 'Záloha', reimbursable: true, docs: { accounting: ['Účtenka 55120'], payment: [] } },
  { n: 3, category: 'Dálniční známka', description: 'Digitální známka Rakousko, 10 dní', supplier: 'ASFINAG', date: '13. 10. 2026', amount: 12.8, currency: 'EUR', rate: 24.315, rateSource: 'ČNB 13. 10. 2026', czk: r2(12.8 * 24.315), payment: 'Soukromá karta', payer: 'Zaměstnanec', reimbursable: true, docs: { accounting: ['Potvrzení objednávky'], payment: [] }, note: 'Chybí doklad o zaplacení' },
  { n: 4, category: 'MHD', description: 'Jízdenka 24 h, Vídeň', supplier: 'Wiener Linien', date: '15. 10. 2026', amount: 8, currency: 'EUR', rate: advance.rate, rateSource: 'Kurz zálohy', czk: r2(8 * advance.rate), payment: 'Hotovost ze zálohy', payer: 'Záloha', reimbursable: true, docs: { accounting: ['Jízdenka'], payment: [] } },
  { n: 5, category: 'Pohonné hmoty', description: 'Natural 95, 45,2 l (doklad pro cenu PHM)', supplier: 'Čerpací stanice Mikulov', date: '16. 10. 2026', amount: 1758.28, currency: 'CZK', rate: 1, rateSource: '–', czk: 1758.28, payment: 'Soukromá karta', payer: 'Zaměstnanec', reimbursable: false, docs: { accounting: ['Účtenka 004417'], payment: [] }, note: 'Neproplácí se zvlášť – slouží k určení ceny PHM v náhradě za vozidlo' },
];

const kmTotal = segments.reduce((s, x) => s + x.km, 0);
const fuelLitresExact = (kmTotal * 5.6) / 100;
const fuelLitres = r2(fuelLitresExact);
export const vehicle = {
  label: 'Škoda Octavia',
  plate: '1AB 2345',
  owner: 'Jana Ukázková',
  fuel: 'Benzin (Natural 95)',
  consumption: '5,6 l/100 km (kombinovaná, TP)',
  km: kmTotal,
  ratePerKm: 5.9, // ILUSTRATIVNÍ
  fuelPrice: 38.9,
  fuelPriceSource: 'Doklad o tankování (výdaj č. 5)',
  fuelLitres,
  basic: r2(kmTotal * 5.9),
  fuelComp: r2(fuelLitresExact * 38.9),
  get total() {
    return r2(this.basic + this.fuelComp);
  },
  requestedByEmployer: true,
};

const perDiemEur = perDiem.reduce((s, d) => s + d.result, 0);
const eurFromAdvance = expenses.filter((e) => e.payer === 'Záloha').reduce((s, e) => s + e.amount, 0);
const czkPaidByEmployee = r2(expenses.filter((e) => e.payer === 'Zaměstnanec' && e.reimbursable).reduce((s, e) => s + e.czk, 0));
const eurClaim = perDiemEur + eurFromAdvance;
const eurBalance = r2(eurClaim - advance.amount); // > 0 doplatek, < 0 vratka
const eurBalanceCzk = r2(eurBalance * advance.rate);
const czkClaim = r2(czkPaidByEmployee + vehicle.total);
const payoutExact = r2(czkClaim + eurBalanceCzk);

export const summary = {
  domesticPerDiem: 0,
  foreignPerDiemEur: perDiemEur,
  mealReductionEur: r2(perDiem.reduce((s, d) => s + d.reduction, 0)),
  travelCzk: r2(expenses.filter((e) => ['Dálniční známka', 'MHD', 'Parkovné'].includes(e.category)).reduce((s, e) => s + e.czk, 0)),
  accommodationCzk: 5812.44,
  vehicleCzk: vehicle.total,
  paidByEmployeeCzk: czkPaidByEmployee,
  paidFromAdvanceEur: eurFromAdvance,
  paidByEmployerCzk: 0,
  advanceEur: advance.amount,
  eurClaim,
  eurBalance,
  eurBalanceCzk,
  czkClaim,
  payoutExact,
  payout: Math.round(payoutExact), // návrh Ú-8: celková částka na celé Kč
  totalCostCzk: r2(perDiemEur * advance.rate + expenses.filter((e) => e.reimbursable).reduce((s, e) => s + e.czk, 0) + vehicle.total),
  documentCount: expenses.reduce((s, e) => s + e.docs.accounting.length + e.docs.payment.length, 0),
};

export const declaration =
  'Prohlašuji, že jsem pracovní cestu vykonal(a) podle uvedených údajů, že všechny údaje jsou pravdivé a úplné a že předložené doklady se vztahují k této pracovní cestě.';
