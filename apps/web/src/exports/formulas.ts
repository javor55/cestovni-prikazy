// Listy XLSX s celým výpočtem jako vzorci – pro kontrolu účetní. Vstupy (doby po dnech, sazby, kurzy, částky)
// jsou hodnoty z aplikace, výsledky jsou vzorce Excelu stejné jako ve výpočetním jádru. Sloupec „Kontrola“
// porovná výsledek vzorce s částkou, kterou spočítala aplikace.

import { minorPerUnit, type CalculationResult } from '@cp/core';
import { formula, type Cell, type Table } from '@cp/documents/tabular';
import { ruleSets, type RoundingMode } from '@cp/rules';
import { FUEL_CATEGORIES, type Mapped } from '../model/toInput.js';
import { normalizeDecimal } from '../model/format.js';
import type { TripDoc } from '../model/trip.js';

const units = (minor: number, currency = 'CZK') => minor / minorPerUnit(currency);
const r2 = (x: number) => Math.round(x * 100) / 100;

const SHEET = { params: 'Parametry', perDiem: 'Vypocet stravne', expenses: 'Vypocet vydaje', vehicle: 'Vypocet vozidlo', settlement: 'Vypocet vyuctovani' } as const;
const ref = (sheet: string, cell: string) => `'${sheet}'!${cell}`;
const OK = (cond: string) => formula(`IF(${cond},"OK","ROZDÍL")`, 'OK');
const same = (a: string, b: string) => `ABS(${a}-${b})<0.005`;

/** Zaokrouhlení podle sady pravidel. ROUND(x,6) odstraní šum plovoucí čárky před zaokrouhlením nahoru. */
function round(expr: string, mode: RoundingMode): string {
  if (mode === 'CEIL_UNIT') return `ROUNDUP(ROUND(${expr},6),0)`;
  if (mode === 'HALF_UP_UNIT') return `ROUND(${expr},0)`;
  return expr;
}

/** Vnořené IF podle minut: nejdřív nejvyšší pásmo, pak nižší, pod nejnižším 0. Pásma jsou seřazená vzestupně. */
function byBand(minutes: string, rows: { from: string; value: string }[]): string {
  return rows.reduce((acc, r) => `IF(${minutes}>=${r.from},${r.value},${acc})`, '0');
}

export interface FormulaInput {
  trip: TripDoc;
  mapped: Mapped;
  result?: CalculationResult;
}

/** Listy s výpočtem; bez úspěšného výpočtu žádné (data jsou v ostatních listech a v listu Kontroly). */
export function formulaTables({ trip, mapped, result }: FormulaInput): Table[] {
  const input = mapped.input;
  const pd = result?.perDiem;
  const s = result?.settlement;
  const rules = ruleSets.find((x) => x.id === result?.ruleSet?.id) ?? ruleSets[0]!;
  if (!input || !pd || !s) return [];

  // --- Parametry ---
  const params: Cell[][] = [];
  const bandRows: { from: string; rate: string; pct: string }[] = [];
  for (const b of rules.domestic.bands) {
    const own = input.employerRates?.domestic?.[b.id];
    const rate = own ?? (input.sector === 'business' ? b.business.min : b.public.min);
    const row = params.length + 2;
    params.push([`Tuzemské stravné ${b.id} h`, b.minMinutes, b.maxMinutes, units(rate), b.mealReductionPct, own !== undefined ? 'sazba podle vnitřního předpisu' : input.sector === 'business' ? 'zákonné minimum' : 'dolní hranice rozpětí']);
    bandRows.push({ from: `${SHEET.params}!$B$${row}`, rate: `${SHEET.params}!$D$${row}`, pct: `${SHEET.params}!$E$${row}` });
  }
  const tierRows: { from: string; part: string; pct: string }[] = [];
  for (const t of rules.foreign.tiers) {
    const row = params.length + 2;
    params.push([`Zahraniční stravné – část ${t.id}`, t.minMinutes, t.maxMinutes, formula(`${t.numerator}/${t.denominator}`, t.numerator / t.denominator), t.mealReductionPct, `krácení z ${rules.foreign.mealReductionBase === 'TIER_AMOUNT' ? 'částky pro pásmo' : 'základní sazby'}`]);
    tierRows.push({ from: `${SHEET.params}!$B$${row}`, part: `${SHEET.params}!$D$${row}`, pct: `${SHEET.params}!$E$${row}` });
  }
  const pocketPct = Math.min(input.employerRates?.pocketMoneyPct ?? 0, rules.foreign.pocketMoneyMaxPct);
  const pocketRow = params.length + 2;
  params.push(['Kapesné (% zahraničního stravného)', null, null, pocketPct, null, `nejvýše ${rules.foreign.pocketMoneyMaxPct} %`]);
  const kmRow = params.length + 2;
  const vehicleType = input.vehicle?.type ?? 'car';
  params.push(['Základní náhrada za 1 km', null, null, units(rules.vehicle.ratesPerKm[vehicleType]?.amount ?? 0), null, vehicleType === 'car' ? 'osobní automobil' : 'jednostopé vozidlo']);
  const roundingText = { NONE: 'nezaokrouhluje se', HALF_UP_UNIT: 'matematicky na celé jednotky', CEIL_UNIT: 'nahoru na celé jednotky' } as const;
  params.push(['Zaokrouhlení tuzemského stravného za den', null, null, null, null, roundingText[rules.rounding.domesticPerDay]]);
  params.push(['Zaokrouhlení zahraničního stravného za den', null, null, null, null, roundingText[rules.rounding.foreignPerDay]]);
  params.push(['Přepočet cizí měny na Kč', null, null, null, null, 'částka × kurz ÷ množství, na haléře']);
  params.push(['Zaokrouhlení částky k výplatě', null, null, null, null, roundingText[rules.rounding.payout]]);
  params.push(['Sada pravidel', null, null, null, null, `${rules.id} v${rules.version}`]);

  // --- Stravné po dnech ---
  const days = pd.days;
  const last = days.length + 1;
  const dayRows: Cell[][] = days.map((d, i) => {
    const r = i + 2;
    const x = d.foreign;
    const reductionBase = rules.foreign.mealReductionBase === 'TIER_AMOUNT' ? `N${r}` : `L${r}`;
    const domesticExpr = `MAX(D${r}-F${r},0)`;
    const foreignExpr = `MAX(N${r}-Q${r},0)`;
    const domesticV = units(d.domestic?.amount ?? 0);
    const foreignV = x ? units(x.amount, x.currency) : 0;
    return [
      d.date,
      d.domesticMinutes,
      d.domestic?.freeMeals ?? 0,
      formula(byBand(`B${r}`, bandRows.map((b) => ({ from: b.from, value: b.rate }))), units(d.domestic?.rate ?? 0)),
      formula(byBand(`B${r}`, bandRows.map((b) => ({ from: b.from, value: b.pct }))), d.domestic?.reductionPct ?? 0),
      formula(`D${r}*E${r}/100*C${r}`, units(d.domestic?.reduction ?? 0)),
      formula(rules.rounding.domesticPerDay === 'NONE' ? `ROUND(${domesticExpr},2)` : round(domesticExpr, rules.rounding.domesticPerDay), domesticV),
      domesticV,
      d.foreignMinutes,
      x?.country ?? '',
      x?.currency ?? '',
      x ? units(x.baseRate, x.currency) : 0,
      formula(byBand(`I${r}`, tierRows.map((t) => ({ from: t.from, value: t.part }))), x ? (rules.foreign.tiers.find((t) => t.id === x.tierId)?.numerator ?? 0) / (rules.foreign.tiers.find((t) => t.id === x.tierId)?.denominator ?? 1) : 0),
      formula(`L${r}*M${r}`, x ? units(x.tierAmount, x.currency) : 0),
      x?.freeMeals ?? 0,
      formula(byBand(`I${r}`, tierRows.map((t) => ({ from: t.from, value: t.pct }))), x?.reductionPct ?? 0),
      formula(`${reductionBase}*P${r}/100*O${r}`, x ? units(x.reduction, x.currency) : 0),
      formula(round(foreignExpr, rules.rounding.foreignPerDay), foreignV),
      formula(`R${r}*${SHEET.params}!$D$${pocketRow}/100`, d.pocketMoney ? units(d.pocketMoney.amount, d.pocketMoney.currency) : 0),
      foreignV,
      OK(`AND(${same(`G${r}`, `H${r}`)},${same(`ROUND(R${r},2)`, `T${r}`)})`),
    ];
  });

  // --- Výdaje ---
  const expRows: Cell[][] = result.expenses.map((e, i) => {
    const r = i + 2;
    const doc = trip.expenses.find((x) => x.id === e.id);
    const how = e.currency === 'CZK' ? 'CZK' : e.rateSource === 'BANK_CONFIRMATION' ? 'potvrzení banky' : e.rateSource === 'ADVANCE_RATE' ? 'kurz zálohy' : 'kurz';
    const qty = doc && FUEL_CATEGORIES.has(doc.category) ? Number(normalizeDecimal(doc.fuelQuantity) ?? 0) : 0;
    return [
      e.order,
      doc?.date ?? '',
      e.category,
      units(e.amount, e.currency),
      e.currency,
      how,
      how === 'kurz' || how === 'kurz zálohy' ? Number(e.rate) : null,
      how === 'kurz' || how === 'kurz zálohy' ? (e.rateUnit ?? 1) : null,
      how === 'potvrzení banky' ? units(e.czk) : null,
      formula(`IF(E${r}="CZK",D${r},IF(F${r}="potvrzení banky",I${r},ROUND(D${r}*G${r}/H${r},2)))`, units(e.czk)),
      { EMPLOYEE: 'zaměstnanec', ADVANCE: 'ze zálohy', EMPLOYER: 'zaměstnavatel' }[e.payer],
      e.reimbursable ? 'ano' : 'ne',
      qty || null,
      units(e.czk),
      OK(same(`J${r}`, `N${r}`)),
    ];
  });
  const expLast = Math.max(2, expRows.length + 1);
  const E = (col: string) => ref(SHEET.expenses, `$${col}$2:$${col}$${expLast}`);

  // --- Vozidlo ---
  const v = result.vehicle;
  const vehRows: Cell[][] = [];
  if (v) {
    const price =
      v.fuelPriceSource === 'RECEIPTS'
        ? formula(`ROUND(SUMPRODUCT((${E('M')}>0)*${E('J')})/SUMIF(${E('M')},">0"),2)`, units(v.fuelPrice))
        : units(v.fuelPrice);
    const source = { RECEIPT: 'cena z dokladu', RECEIPTS: 'vážený průměr z dokladů o tankování (list Vypocet vydaje, sloupec M)', AVERAGE: `průměrná cena – ${v.fuelPriceRef}`, AVERAGE_MANUAL: `průměrná cena zadaná ručně – ${v.fuelPriceRef}` }[v.fuelPriceSource];
    vehRows.push(
      ['Ujeté kilometry', Number(v.km), Number(v.km), null],
      ['Základní náhrada za 1 km (Kč)', formula(`${SHEET.params}!$D$${kmRow}`, units(v.ratePerKm)), units(v.ratePerKm), null],
      [`Spotřeba na 100 km (${v.unit})`, Number(v.consumption), Number(v.consumption), null],
      [`Cena paliva za 1 ${v.unit} (Kč) – ${source}`, price, units(v.fuelPrice), OK(same('B5', 'C5'))],
      ['Základní náhrada = km × sazba', formula('ROUND(B2*B3,2)', units(v.basic)), units(v.basic), OK(same('B6', 'C6'))],
      [`Spotřebované množství (${v.unit}) = km × spotřeba ÷ 100`, formula('B2*B4/100', Number(v.quantity)), Number(v.quantity), null],
      ['Náhrada za palivo = množství × cena', formula('ROUND(B7*B5,2)', units(v.fuelCompensation)), units(v.fuelCompensation), OK(same('B8', 'C8'))],
      ['Náhrada celkem', formula('B6+B8', units(v.total)), units(v.total), OK(same('B9', 'C9'))],
    );
  }

  // --- Vyúčtování ---
  const P = (col: string) => ref(SHEET.perDiem, `$${col}$2:$${col}$${Math.max(2, last)}`);
  const setRows: Cell[][] = [];
  const at = () => setRows.length + 2;
  const add = (label: string, currency: string, value: Cell, app: number | null, check = false) => {
    const r = at();
    setRows.push([label, currency, value, app, check && app !== null ? OK(same(`C${r}`, `D${r}`)) : null]);
    return `C${r}`;
  };
  const domestic = add('Tuzemské stravné', 'CZK', formula(`SUM(${P('G')})`, units(pd.domesticTotal)), units(pd.domesticTotal), true);
  const czkParts: string[] = [domestic];
  const balanceParts: string[] = [];
  const currencies = [...new Set([...Object.keys(pd.foreignTotals), ...s.currencies.map((c) => c.currency), ...s.convertedPerDiem.map((c) => c.currency)])].filter((c) => c !== 'CZK').sort();
  for (const cur of currencies) {
    const conv = s.convertedPerDiem.find((c) => c.currency === cur);
    const adv = s.currencies.find((c) => c.currency === cur);
    const sumPd = add(`Zahraniční stravné ${cur}`, cur, formula(`SUMIF(${P('K')},"${cur}",${P('R')})`, units(pd.foreignTotals[cur] ?? 0, cur)), null);
    const sumPm = add(`Kapesné ${cur}`, cur, formula(`SUMIF(${P('K')},"${cur}",${P('S')})`, units(pd.pocketMoneyTotals[cur] ?? 0, cur)), null);
    if (conv) {
      const rate = add(`Kurz Kč za ${conv.rateUnit} ${cur}`, '', Number(conv.rate), Number(conv.rate));
      const unit = add('Množství (kurz je za)', '', conv.rateUnit, conv.rateUnit);
      czkParts.push(add(`Zahraniční stravné ${cur} v Kč = (stravné + kapesné) × kurz ÷ množství`, 'CZK', formula(`ROUND((${sumPd}+${sumPm})*${rate}/${unit},2)`, units(conv.czk)), units(conv.czk), true));
    } else if (adv) {
      const fromAdv = add(`Výdaje uhrazené ze zálohy v ${cur}`, cur, formula(`SUMIFS(${E('D')},${E('E')},"${cur}",${E('K')},"ze zálohy")`, units(adv.fromAdvance, cur)), units(adv.fromAdvance, cur));
      const advance = add(`Záloha v ${cur}`, cur, units(adv.advance, cur), units(adv.advance, cur));
      const balance = add(`Doplatek (+) / přeplatek (−) v ${cur}`, cur, formula(`${sumPd}+${sumPm}+${fromAdv}-${advance}`, r2(units(adv.balance, cur))), null);
      const rate = add(`Kurz zálohy Kč za ${adv.rateUnit ?? 1} ${cur}`, '', Number(adv.rate ?? 0), Number(adv.rate ?? 0));
      const unit = add('Množství (kurz je za)', '', adv.rateUnit ?? 1, adv.rateUnit ?? 1);
      balanceParts.push(add(`Doplatek / přeplatek ${cur} v Kč`, 'CZK', formula(`ROUND(${balance}*${rate}/${unit},2)`, units(adv.balanceCzk)), units(adv.balanceCzk), true));
    }
  }
  czkParts.push(add('Výdaje uhrazené zaměstnancem (proplácené)', 'CZK', formula(`SUMIFS(${E('J')},${E('K')},"zaměstnanec",${E('L')},"ano")`, units(s.employeeExpensesCzk)), units(s.employeeExpensesCzk), true));
  const czkFromAdvance = result.expenses.filter((e) => e.payer === 'ADVANCE' && e.currency === 'CZK').reduce((sum, e) => sum + e.czk, 0);
  if (czkFromAdvance) czkParts.push(add('Výdaje uhrazené z korunové zálohy', 'CZK', formula(`SUMIFS(${E('J')},${E('K')},"ze zálohy",${E('E')},"CZK")`, units(czkFromAdvance)), units(czkFromAdvance), true));
  if (v) czkParts.push(add('Náhrada za soukromé vozidlo', 'CZK', formula(ref(SHEET.vehicle, '$B$9'), units(s.vehicleCzk)), units(s.vehicleCzk), true));
  const claim = add('Nárok v Kč', 'CZK', formula(czkParts.join('+'), units(s.claimCzk)), units(s.claimCzk), true);
  const advanceCzk = add('Záloha v Kč', 'CZK', units(s.advanceCzk), units(s.advanceCzk));
  const exact = add('K výplatě přesně (záporné = vratka)', 'CZK', formula(`${claim}-${advanceCzk}${balanceParts.map((b) => `+${b}`).join('')}`, units(s.payoutExact)), units(s.payoutExact), true);
  add(
    'K výplatě zaměstnanci (zaokrouhleno)',
    'CZK',
    formula(rules.rounding.payout === 'NONE' ? `ROUND(${exact},2)` : rules.rounding.payout === 'CEIL_UNIT' ? `SIGN(${exact})*ROUNDUP(ROUND(ABS(${exact}),6),0)` : `ROUND(${exact},0)`, units(s.payout)),
    units(s.payout),
    true,
  );
  // Výdaje zaměstnavatele jsou jen náklad – nevyplácejí se.
  add('Uhrazeno přímo zaměstnavatelem (jen náklad)', 'CZK', formula(`SUMIFS(${E('J')},${E('K')},"zaměstnavatel")`, units(s.employerPaidCzk)), units(s.employerPaidCzk), true);

  const tables: Table[] = [
    {
      name: SHEET.settlement,
      file: 'vypocet-vyuctovani',
      columns: [
        { header: 'Položka', type: 'text', width: 58 },
        { header: 'Měna', type: 'text', width: 7 },
        { header: 'Výpočet (vzorec)', type: 'amount', width: 16 },
        { header: 'Aplikace', type: 'amount', width: 14 },
        { header: 'Kontrola', type: 'text', width: 10 },
      ],
      rows: setRows,
    },
    {
      name: SHEET.perDiem,
      file: 'vypocet-stravne',
      columns: [
        { header: 'Datum', type: 'date', width: 11 },
        { header: 'Minut v ČR', type: 'integer', width: 9 },
        { header: 'Bezpl. jídla (tuz.)', type: 'integer', width: 9 },
        { header: 'Sazba pásma Kč', type: 'amount', width: 11 },
        { header: 'Krácení %', type: 'integer', width: 8 },
        { header: 'Krácení Kč', type: 'amount', width: 10 },
        { header: 'Tuzemské stravné', type: 'amount', width: 12 },
        { header: 'Aplikace: tuzemské', type: 'amount', width: 12 },
        { header: 'Minut v zahraničí', type: 'integer', width: 10 },
        { header: 'Rozhodující stát', type: 'text', width: 9 },
        { header: 'Měna', type: 'text', width: 6 },
        { header: 'Základní sazba', type: 'amount', width: 10 },
        { header: 'Část sazby', type: 'number', width: 9 },
        { header: 'Částka pásma', type: 'number', width: 11 },
        { header: 'Bezpl. jídla (zahr.)', type: 'integer', width: 9 },
        { header: 'Krácení %', type: 'integer', width: 8 },
        { header: 'Krácení', type: 'number', width: 10 },
        { header: 'Zahraniční stravné', type: 'number', width: 12 },
        { header: 'Kapesné', type: 'number', width: 9 },
        { header: 'Aplikace: zahraniční', type: 'amount', width: 12 },
        { header: 'Kontrola', type: 'text', width: 10 },
      ],
      rows: dayRows,
    },
    {
      name: SHEET.expenses,
      file: 'vypocet-vydaje',
      columns: [
        { header: 'Č.', type: 'integer', width: 5 },
        { header: 'Datum', type: 'date', width: 11 },
        { header: 'Kategorie', type: 'text', width: 16 },
        { header: 'Částka', type: 'amount', width: 12 },
        { header: 'Měna', type: 'text', width: 6 },
        { header: 'Přepočet', type: 'text', width: 15 },
        { header: 'Kurz', type: 'number', width: 9 },
        { header: 'Množství', type: 'integer', width: 8 },
        { header: 'Stržená částka Kč', type: 'amount', width: 12 },
        { header: 'Částka v Kč', type: 'amount', width: 12 },
        { header: 'Plátce', type: 'text', width: 13 },
        { header: 'Proplácí se', type: 'text', width: 9 },
        { header: 'Množství paliva', type: 'number', width: 9 },
        { header: 'Aplikace: Kč', type: 'amount', width: 12 },
        { header: 'Kontrola', type: 'text', width: 10 },
      ],
      rows: expRows,
    },
  ];
  if (v) {
    tables.push({
      name: SHEET.vehicle,
      file: 'vypocet-vozidlo',
      columns: [
        { header: 'Položka', type: 'text', width: 62 },
        { header: 'Výpočet (vzorec)', type: 'number', width: 16 },
        { header: 'Aplikace', type: 'number', width: 14 },
        { header: 'Kontrola', type: 'text', width: 10 },
      ],
      rows: vehRows,
    });
  }
  tables.push({
    name: SHEET.params,
    file: 'parametry',
    columns: [
      { header: 'Parametr', type: 'text', width: 40 },
      { header: 'Od (minut za den)', type: 'integer', width: 10 },
      { header: 'Do (minut za den)', type: 'integer', width: 10 },
      { header: 'Hodnota', type: 'number', width: 10 },
      { header: 'Krácení za jídlo %', type: 'integer', width: 10 },
      { header: 'Poznámka', type: 'text', width: 44 },
    ],
    rows: params,
  });
  return tables;
}
