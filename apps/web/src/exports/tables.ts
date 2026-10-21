// Tabulky pro export XLSX a CSV (zadání § 20). Částky jsou čísla v jednotkách měny, měna je v samostatném
// sloupci, data a časy v ISO tvaru. Tabulky se plní z výsledku výpočtu – stejná čísla jako v PDF.

import { minorPerUnit, type CalculationResult, type ExpensePayer } from '@cp/core';
import type { Cell, Table } from '@cp/documents/tabular';
import { countryName } from '../model/countries.js';
import { normalizeDecimal } from '../model/format.js';
import { payerOf, type DocCounts, type Mapped } from '../model/toInput.js';
import { fuelLabels, paymentLabels, rateSourceLabels, transportLabels, type TripDoc } from '../model/trip.js';

const units = (minor: number, currency = 'CZK') => minor / minorPerUnit(currency);
const yesNo = (b: boolean) => (b ? 'ano' : 'ne');
const num = (text: string) => {
  const n = normalizeDecimal(text);
  return n === null ? null : Number(n);
};

const payerLabels: Record<ExpensePayer, string> = { EMPLOYEE: 'zaměstnanec', ADVANCE: 'ze zálohy', EMPLOYER: 'zaměstnavatel' };

export interface TablesInput {
  trip: TripDoc;
  mapped: Mapped;
  result?: CalculationResult;
  docCounts: DocCounts;
}

function summary({ trip, mapped, result }: TablesInput): Table {
  const rows: Cell[][] = [];
  const text = (label: string, value: string) => rows.push([label, value, null, null]);
  const money = (label: string, minor: number, currency = 'CZK') => rows.push([label, null, units(minor, currency), currency]);

  text('Číslo cesty', trip.number);
  text('Druh cesty', trip.kind === 'foreign' ? 'zahraniční' : 'tuzemská');
  text('Zaměstnanec', trip.employee.name);
  text('Osobní číslo', trip.employee.personalNumber);
  text('Zaměstnavatel', trip.employer.name);
  text('IČO', trip.employer.ico);
  text('Účel cesty', trip.purpose);
  text('Začátek', mapped.actualStart);
  text('Konec', mapped.actualEnd);
  text('Sazby', result?.ruleSet ? `${result.ruleSet.id} v${result.ruleSet.version}` : '');
  text('Stav výpočtu', result?.ok ? 'bez blokujících chyb' : 'obsahuje blokující chyby – částky nejsou spolehlivé');

  const s = result?.settlement;
  const pd = result?.perDiem;
  if (s && pd) {
    money('Tuzemské stravné', pd.domesticTotal);
    for (const [c, a] of Object.entries(pd.foreignTotals)) money('Zahraniční stravné', a, c);
    for (const [c, a] of Object.entries(pd.pocketMoneyTotals)) if (a) money('Kapesné', a, c);
    for (const c of s.convertedPerDiem) money(`Zahraniční stravné ${c.currency} přepočtené na Kč`, c.czk);
    money('Výdaje celkem', result.expenses.reduce((sum, e) => sum + e.czk, 0));
    money('Výdaje uhrazené zaměstnancem', s.employeeExpensesCzk);
    money('Výdaje uhrazené zaměstnavatelem', s.employerPaidCzk);
    if (result.vehicle) money('Náhrada za soukromé vozidlo', s.vehicleCzk);
    for (const c of s.currencies) {
      money('Záloha', c.advance, c.currency);
      money(c.balance >= 0 ? 'Doplatek v měně zálohy' : 'Přeplatek v měně zálohy', Math.abs(c.balance), c.currency);
      money(c.balance >= 0 ? `Doplatek ${c.currency} v Kč` : `Přeplatek ${c.currency} v Kč`, Math.abs(c.balanceCzk));
    }
    if (s.advanceCzk) money('Záloha', s.advanceCzk);
    money('Nárok v Kč', s.claimCzk);
    money(s.payout >= 0 ? 'K výplatě zaměstnanci' : 'Vratka zaměstnance', Math.abs(s.payout));
    money('Celkové náklady cesty', s.totalCostCzk);
  }
  return {
    name: 'Souhrn',
    file: 'souhrn',
    columns: [
      { header: 'Položka', type: 'text', width: 38 },
      { header: 'Hodnota', type: 'text', width: 44 },
      { header: 'Částka', type: 'amount', width: 14 },
      { header: 'Měna', type: 'text', width: 8 },
    ],
    rows,
  };
}

function segments({ trip }: TablesInput): Table {
  return {
    name: 'Useky',
    file: 'useky',
    columns: [
      { header: 'Pořadí', type: 'integer', width: 8 },
      { header: 'Výchozí místo', type: 'text', width: 20 },
      { header: 'Výchozí stát', type: 'text', width: 8 },
      { header: 'Cílové místo', type: 'text', width: 20 },
      { header: 'Cílový stát', type: 'text', width: 8 },
      { header: 'Odjezd', type: 'datetime', width: 16 },
      { header: 'Příjezd', type: 'datetime', width: 16 },
      { header: 'Dopravní prostředek', type: 'text', width: 18 },
      { header: 'Dopravce', type: 'text', width: 16 },
      { header: 'Kilometry', type: 'number', width: 10 },
      { header: 'Přechod hranice', type: 'text', width: 10 },
      { header: 'Čas přechodu hranice', type: 'datetime', width: 16 },
      { header: 'Soukromá část', type: 'text', width: 10 },
      { header: 'Poznámka', type: 'text', width: 24 },
    ],
    rows: [...trip.segments]
      .sort((a, b) => a.departure.localeCompare(b.departure))
      .map((s, i) => {
        const border = s.fromCountry !== s.toCountry;
        return [i + 1, s.fromPlace, s.fromCountry, s.toPlace, s.toCountry, s.departure, s.arrival, transportLabels[s.transport], s.carrier, num(s.km), border ? `${s.fromCountry}–${s.toCountry}` : '', border ? s.crossingAt : '', yesNo(s.private), s.note];
      }),
  };
}

function perDiem({ trip, result }: TablesInput): Table {
  const rows: Cell[][] = [];
  for (const d of result?.perDiem?.days ?? []) {
    const m = trip.meals[d.date] ?? { breakfast: false, lunch: false, dinner: false };
    const meals = [yesNo(m.breakfast), yesNo(m.lunch), yesNo(m.dinner)];
    if (d.domestic) {
      const x = d.domestic;
      rows.push([d.date, 'tuzemské', 'CZ', 'Česko', d.domesticMinutes, `${x.bandId} h`, units(x.rate), units(x.rate), 'CZK', ...meals, x.freeMeals, x.reductionPct, units(x.reduction), units(x.amount), null]);
    }
    if (d.foreign) {
      const x = d.foreign;
      const pm = d.pocketMoney;
      rows.push([d.date, 'zahraniční', x.country, x.countryName, d.foreignMinutes, x.tierId, units(x.baseRate, x.currency), units(x.tierAmount, x.currency), x.currency, ...meals, x.freeMeals, x.reductionPct, units(x.reduction, x.currency), units(x.amount, x.currency), pm ? units(pm.amount, pm.currency) : null]);
    }
    if (!d.domestic && !d.foreign) {
      const c = d.countries[0]?.country ?? 'CZ';
      rows.push([d.date, 'bez nároku', c, countryName(c), d.domesticMinutes + d.foreignMinutes, '', null, null, '', ...meals, null, null, null, 0, null]);
    }
  }
  return {
    name: 'Stravne',
    file: 'stravne',
    columns: [
      { header: 'Datum', type: 'date', width: 11 },
      { header: 'Stravné', type: 'text', width: 11 },
      { header: 'Stát', type: 'text', width: 6 },
      { header: 'Název státu', type: 'text', width: 16 },
      { header: 'Rozhodná doba (min)', type: 'integer', width: 12 },
      { header: 'Pásmo', type: 'text', width: 10 },
      { header: 'Základní sazba', type: 'amount', width: 12 },
      { header: 'Sazba pro pásmo', type: 'amount', width: 12 },
      { header: 'Měna', type: 'text', width: 6 },
      { header: 'Snídaně', type: 'text', width: 8 },
      { header: 'Oběd', type: 'text', width: 8 },
      { header: 'Večeře', type: 'text', width: 8 },
      { header: 'Bezplatných jídel', type: 'integer', width: 10 },
      { header: 'Krácení za jídlo (%)', type: 'integer', width: 10 },
      { header: 'Krácení', type: 'amount', width: 12 },
      { header: 'Výsledná částka', type: 'amount', width: 12 },
      { header: 'Kapesné', type: 'amount', width: 10 },
    ],
    rows,
  };
}

function expenses({ trip, result, docCounts }: TablesInput): Table {
  return {
    name: 'Vydaje',
    file: 'vydaje',
    columns: [
      { header: 'ID', type: 'integer', width: 5 },
      { header: 'Kategorie', type: 'text', width: 16 },
      { header: 'Popis', type: 'text', width: 24 },
      { header: 'Dodavatel', type: 'text', width: 18 },
      { header: 'Číslo dokladu', type: 'text', width: 14 },
      { header: 'Datum', type: 'date', width: 11 },
      { header: 'Částka', type: 'amount', width: 12 },
      { header: 'Měna', type: 'text', width: 6 },
      { header: 'Kurz', type: 'number', width: 9 },
      { header: 'Množství', type: 'integer', width: 8 },
      { header: 'Zdroj kurzu', type: 'text', width: 18 },
      { header: 'Datum kurzu', type: 'date', width: 11 },
      { header: 'Částka v Kč', type: 'amount', width: 12 },
      { header: 'Způsob úhrady', type: 'text', width: 18 },
      { header: 'Plátce', type: 'text', width: 13 },
      { header: 'Proplácí se', type: 'text', width: 9 },
      { header: 'Účetních dokladů', type: 'integer', width: 9 },
      { header: 'Dokladů o zaplacení', type: 'integer', width: 9 },
      { header: 'Poznámka', type: 'text', width: 24 },
    ],
    rows: trip.expenses.map((e, i) => {
      const r = result?.expenses.find((x) => x.id === e.id);
      const c = docCounts[e.id] ?? { accounting: 0, payment: 0 };
      const currency = e.currency.trim().toUpperCase();
      const foreign = currency !== 'CZK';
      const source = !foreign ? '' : r?.rateSource === 'ADVANCE_RATE' ? 'Kurz zálohy' : rateSourceLabels[e.rateSource];
      return [
        i + 1,
        e.category,
        e.description,
        e.supplier,
        e.documentNumber,
        e.date,
        r ? units(r.amount, r.currency) : num(e.amount),
        currency,
        foreign && r?.rate ? Number(r.rate) : null,
        foreign && r?.rate ? (r.rateUnit ?? 1) : null,
        source,
        foreign && e.rateSource === 'CNB' && r?.rateSource === 'CNB' ? e.rateDate : '',
        r ? units(r.czk) : null,
        paymentLabels[e.paymentMethod],
        payerLabels[payerOf(e.paymentMethod)],
        yesNo(e.reimbursable),
        c.accounting,
        c.payment,
        e.note,
      ];
    }),
  };
}

function vehicle({ trip, result }: TablesInput): Table {
  const v = trip.vehicle;
  const r = result?.vehicle;
  return {
    name: 'Vozidlo',
    file: 'vozidlo',
    columns: [
      { header: 'Vozidlo', type: 'text', width: 18 },
      { header: 'Registrační značka', type: 'text', width: 12 },
      { header: 'Vlastník', type: 'text', width: 16 },
      { header: 'Druh', type: 'text', width: 12 },
      { header: 'Palivo', type: 'text', width: 10 },
      { header: 'Spotřeba na 100 km', type: 'number', width: 10 },
      { header: 'Jednotka', type: 'text', width: 8 },
      { header: 'Kilometry', type: 'number', width: 10 },
      { header: 'Sazba za kilometr', type: 'amount', width: 10 },
      { header: 'Cena paliva', type: 'amount', width: 10 },
      { header: 'Zdroj ceny paliva', type: 'text', width: 22 },
      { header: 'Spotřebované množství', type: 'number', width: 10 },
      { header: 'Základní náhrada', type: 'amount', width: 12 },
      { header: 'Náhrada za palivo', type: 'amount', width: 12 },
      { header: 'Celková náhrada', type: 'amount', width: 12 },
    ],
    rows:
      v.used && r
        ? [
            [
              v.model,
              v.plate,
              v.owner,
              v.type === 'motorcycle' ? 'motocykl' : 'osobní automobil',
              fuelLabels[v.fuel],
              Number(r.consumption),
              r.unit,
              Number(r.km),
              units(r.ratePerKm),
              units(r.fuelPrice),
              r.fuelPriceSource === 'RECEIPT' ? 'doklad o nákupu' : `průměrná cena (${r.fuelPriceRef})`,
              Number(r.quantity),
              units(r.basic),
              units(r.fuelCompensation),
              units(r.total),
            ],
          ]
        : [],
  };
}

function checks({ mapped, result }: TablesInput): Table {
  const severity = { error: 'chyba', warning: 'varování', info: 'informace' } as const;
  return {
    name: 'Kontroly',
    file: 'kontroly',
    columns: [
      { header: 'Závažnost', type: 'text', width: 11 },
      { header: 'Kód', type: 'text', width: 24 },
      { header: 'Zpráva', type: 'text', width: 90 },
    ],
    rows: [...mapped.issues, ...(result?.issues ?? [])].map((i) => [severity[i.severity], i.code, i.message]),
  };
}

/** Listy podle zadání (Souhrn, Useky, Stravne, Vydaje, Vozidlo) a navíc výsledek kontrol pro účetní. */
export function buildTables(input: TablesInput): Table[] {
  return [summary(input), segments(input), perDiem(input), expenses(input), vehicle(input), checks(input)];
}
