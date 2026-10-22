import { calculate } from '@cp/core';
import { describe, expect, it } from 'vitest';
import { vienna } from '../model/sample.js';
import { toInput } from '../model/toInput.js';
import { formulaTables } from './formulas.js';

function tables() {
  const trip = vienna();
  const mapped = toInput(trip);
  return formulaTables({ trip, mapped, result: calculate(mapped.input!) });
}

const isFormula = (c: unknown): c is { f: string; v: number | string } => typeof c === 'object' && c !== null && 'f' in c;

// Vzorce ověřené přepočtem v LibreOffice (všechny kontroly „OK“); zde se hlídá struktura a uložené hodnoty.
describe('XLSX se vzorci', () => {
  it('listy výpočtu a výsledek k výplatě jako vzorec s hodnotou z aplikace', () => {
    const t = tables();
    expect(t.map((x) => x.name)).toEqual(['Vypocet vyuctovani', 'Vypocet stravne', 'Vypocet vydaje', 'Vypocet vozidlo', 'Parametry']);
    const payout = t[0]!.rows.find((r) => String(r[0]).startsWith('K výplatě zaměstnanci'))!;
    expect(isFormula(payout[2]) && payout[2]).toMatchObject({ f: expect.stringMatching(/^ROUND\(C\d+,0\)$/), v: 12055 });
    expect(payout[3]).toBe(12055);
  });

  it('stravné po dnech: pásmo, krácení a zaokrouhlení podle sady pravidel', () => {
    const day = tables()[1]!.rows[1]!; // 15. 10.: 24 h v Rakousku, snídaně a oběd
    expect(isFormula(day[12]) && day[12].f).toBe('IF(I3>=Parametry!$B$7,Parametry!$D$7,IF(I3>=Parametry!$B$6,Parametry!$D$6,IF(I3>=Parametry!$B$5,Parametry!$D$5,0)))');
    expect(isFormula(day[17]) && day[17]).toEqual({ f: 'MAX(N3-Q3,0)', v: 22.5 });
    expect(isFormula(day[6]) && day[6].f).toBe('ROUNDUP(ROUND(MAX(D3-F3,0),6),0)');
    expect(isFormula(day[20]) && day[20].f).toBe('IF(AND(ABS(G3-H3)<0.005,ABS(ROUND(R3,2)-T3)<0.005),"OK","ROZDÍL")');
  });

  it('výdaje: kurz, potvrzení banky i kurz zálohy', () => {
    const rows = tables()[2]!.rows;
    expect(rows[0]!.slice(5, 10)).toEqual(['potvrzení banky', null, null, 5812.44, expect.objectContaining({ v: 5812.44 })]);
    expect(rows[1]!.slice(5, 8)).toEqual(['kurz zálohy', 24.35, 1]);
  });
});
