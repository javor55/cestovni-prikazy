import { calculate } from '@cp/core';
import { toCsv } from '@cp/documents/tabular';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { vienna } from '../model/sample.js';
import { toInput } from '../model/toInput.js';
import { csvZipFile, jsonFile, xlsxFile } from './files.js';
import { buildTables, type TablesInput } from './tables.js';

function input(): TablesInput {
  const trip = vienna();
  const docCounts = { h: { accounting: 1, payment: 1 } };
  const mapped = toInput(trip, docCounts);
  return { trip, mapped, result: calculate(mapped.input!), docCounts };
}

const byName = (i: TablesInput) => Object.fromEntries(buildTables(i).map((t) => [t.name, t]));
const col = (t: { columns: { header: string }[] }, h: string) => t.columns.findIndex((c) => c.header === h);

describe('tabulky exportu', () => {
  it('obsahuje listy podle zadání', () => {
    expect(buildTables(input()).map((t) => t.name)).toEqual(['Souhrn', 'Useky', 'Stravne', 'Vydaje', 'Vozidlo', 'Kontroly']);
  });

  it('souhrn: částky jsou čísla se samostatnou měnou a sedí s výpočtem', () => {
    const i = input();
    const s = i.result!.settlement!;
    const rows = byName(i).Souhrn!.rows;
    const get = (label: string, cur = 'CZK') => rows.find((r) => r[0] === label && r[3] === cur)?.[2];
    expect(rows.find((r) => r[0] === 'Číslo cesty')![1]).toBe('CP-2026-0042');
    expect(rows.find((r) => r[0] === 'Začátek')![1]).toBe('2026-10-14T06:30');
    expect(get('Zahraniční stravné', 'EUR')).toBe(i.result!.perDiem!.foreignTotals.EUR! / 100);
    expect(get('Záloha', 'EUR')).toBe(100);
    expect(get('K výplatě zaměstnanci')).toBe(s.payout / 100);
    expect(get('Celkové náklady cesty')).toBe(s.totalCostCzk / 100);
  });

  it('úseky: ISO časy, hranice a kilometry jako číslo', () => {
    const t = byName(input()).Useky!;
    expect(t.rows[0]!.slice(0, 7)).toEqual([1, 'Praha', 'CZ', 'Vídeň', 'AT', '2026-10-14T06:30', '2026-10-14T11:00']);
    expect(t.rows[0]![col(t, 'Kilometry')]).toBe(343);
    expect(t.rows[0]![col(t, 'Přechody hranic')]).toBe('CZ–AT 2026-10-14T09:45');
  });

  it('stravné: den s bezplatnou snídaní a obědem je krácený', () => {
    const t = byName(input()).Stravne!;
    const day = t.rows.find((r) => r[0] === '2026-10-15' && r[1] === 'zahraniční')!;
    expect(day.slice(2, 4)).toEqual(['AT', expect.stringMatching(/Rakousko/)]);
    expect(day[col(t, 'Základní sazba')]).toBe(45);
    expect(day[col(t, 'Měna')]).toBe('EUR');
    expect([day[col(t, 'Snídaně')], day[col(t, 'Oběd')], day[col(t, 'Večeře')]]).toEqual(['ano', 'ano', 'ne']);
    expect(day[col(t, 'Bezplatných jídel')]).toBe(2);
    expect(day[col(t, 'Krácení')]).toBeGreaterThan(0);
  });

  it('výdaje: kurz, zdroj kurzu, plátce a počty dokladů', () => {
    const t = byName(input()).Vydaje!;
    const hotel = t.rows[0]!;
    expect(hotel[col(t, 'Částka')]).toBe(238);
    expect(hotel[col(t, 'Měna')]).toBe('EUR');
    expect(hotel[col(t, 'Zdroj kurzu')]).toBe('Podle potvrzení banky');
    expect(hotel[col(t, 'Částka v Kč')]).toBe(5812.44);
    expect([hotel[col(t, 'Účetních dokladů')], hotel[col(t, 'Dokladů o zaplacení')]]).toEqual([1, 1]);
    const parking = t.rows[1]!;
    expect(parking[col(t, 'Plátce')]).toBe('ze zálohy');
    expect(parking[col(t, 'Zdroj kurzu')]).toBe('Kurz zálohy');
    const vignette = t.rows[2]!;
    expect([vignette[col(t, 'Kurz')], vignette[col(t, 'Datum kurzu')]]).toEqual([24.315, '2026-10-12']);
    expect(t.rows[4]![col(t, 'Proplácí se')]).toBe('ne');
  });

  it('vozidlo: sazba, cena paliva a náhrada', () => {
    const i = input();
    const t = byName(i).Vozidlo!;
    expect(t.rows).toHaveLength(1);
    const r = t.rows[0]!;
    expect(r.slice(0, 2)).toEqual(['Škoda Octavia', '1AB 2345']);
    expect(r[col(t, 'Kilometry')]).toBe(686);
    expect(r[col(t, 'Sazba za kilometr')]).toBe(5.9);
    expect(r[col(t, 'Cena paliva')]).toBe(38.9);
    expect(r[col(t, 'Celková náhrada')]).toBe(i.result!.vehicle!.total / 100);
  });

  it('neúplná cesta se exportuje bez pádu', () => {
    const i = input();
    i.trip.segments = [];
    i.trip.plannedStart = '';
    i.mapped = toInput(i.trip);
    delete i.result;
    const t = byName(i);
    expect(t.Souhrn!.rows.find((r) => r[0] === 'Stav výpočtu')![1]).toMatch(/blokující/);
    expect(t.Kontroly!.rows[0]![0]).toBe('chyba');
    expect(t.Vydaje!.rows).toHaveLength(5);
  });

  it('CSV: jeden soubor na tabulku v ZIP, ISO data, desetinná tečka', () => {
    const f = csvZipFile(input(), new Date('2026-10-21T10:00:00Z'));
    expect(f.name).toBe('CP-2026-0042_CSV.zip');
    const files = unzipSync(f.bytes);
    expect(Object.keys(files).sort()).toEqual(['kontroly.csv', 'souhrn.csv', 'stravne.csv', 'useky.csv', 'vozidlo.csv', 'vydaje.csv']);
    expect([...files['vydaje.csv']!.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const vydaje = strFromU8(files['vydaje.csv']!);
    expect(vydaje).toContain(';238.00;EUR;');
    expect(vydaje).toContain(';5812.44;');
    expect(vydaje).toContain(';2026-10-16;');
    expect(toCsv(buildTables(input())[1]!)).toContain('2026-10-14T06:30');
  });

  it('XLSX a JSON: názvy souborů, JSON bez obsahu příloh, se schématem a výpočtem', () => {
    const i = input();
    expect(xlsxFile(i).name).toBe('CP-2026-0042_Vyuctovani.xlsx');
    const att = { id: 'x', tripId: i.trip.id, expenseId: 'h', kind: 'accounting', subtype: '', originalName: 'uctenka.jpg', mime: 'image/jpeg', size: 10, sha256: 'a'.repeat(64), order: 1, createdAt: '', rotation: 0, crop: null, conversion: 'done', pages: 1 } as const;
    const f = jsonFile(i, [att], new Date('2026-10-21T10:00:00Z'));
    expect(f.name).toBe('CP-2026-0042_data.json');
    const data = JSON.parse(strFromU8(f.bytes));
    expect(data).toMatchObject({ format: 'cestovni-prikazy-data', schemaVersion: 8, exportedAt: '2026-10-21T10:00:00.000Z' });
    expect(data.trip.expenses).toHaveLength(5);
    expect(data.attachments[0]).toMatchObject({ originalName: 'uctenka.jpg', sha256: 'a'.repeat(64) });
    expect(data.attachments[0].tripId).toBeUndefined();
    expect(data.calculation.settlement.payout).toBe(i.result!.settlement!.payout);
  });
});
