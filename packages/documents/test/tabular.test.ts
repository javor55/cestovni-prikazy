import ExcelJS from 'exceljs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { toCsv, toXlsx, type Table } from '../src/tabular.js';

const table: Table = {
  name: 'Vydaje',
  file: 'vydaje',
  columns: [
    { header: 'ID', type: 'integer' },
    { header: 'Popis', type: 'text' },
    { header: 'Datum', type: 'date' },
    { header: 'Odjezd', type: 'datetime' },
    { header: 'Částka', type: 'amount' },
    { header: 'Kurz', type: 'number' },
  ],
  rows: [
    [1, 'Hotel „U Lípy“; 2 noci', '2026-10-14', '2026-10-14T06:30', 2380.5, 24.422],
    [2, '=HYPERLINK("http://x")', '', '', 0, null],
    [3, 'řádek\nnový <tag> & "uvozovky"', '2026-03-29', '2026-03-29T02:30', -12, 1],
  ],
};

describe('CSV', () => {
  const csv = toCsv(table);
  const lines = csv.slice(1).split('\r\n');

  it('UTF-8 s BOM, středník, CRLF, ISO data, částky bez měny', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toBe('ID;Popis;Datum;Odjezd;Částka;Kurz');
    expect(lines[1]).toBe('1;"Hotel „U Lípy“; 2 noci";2026-10-14;2026-10-14T06:30;2380.50;24.422');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('text, který vypadá jako vzorec, se neuloží jako vzorec', () => {
    expect(lines[2]).toBe(`2;"'=HYPERLINK(""http://x"")";;;0.00;`);
  });

  it('zalomení řádku a uvozovky jsou v uvozovkách', () => {
    expect(csv).toContain('"řádek\nnový <tag> & ""uvozovky"""');
  });
});

describe('XLSX', () => {
  it('Excel ho přečte: listy, záhlaví, čísla, data, české znaky', async () => {
    const bytes = toXlsx([table, { name: 'Souhrn: [test]', file: 'souhrn', columns: [{ header: 'Položka', type: 'text' }], rows: [['Žluťoučký kůň']] }], new Date('2026-10-21T10:00:00Z'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Vydaje', 'Souhrn   test']);

    const ws = wb.getWorksheet('Vydaje')!;
    expect(ws.getRow(1).values).toEqual([undefined, 'ID', 'Popis', 'Datum', 'Odjezd', 'Částka', 'Kurz']);
    expect(ws.getCell('B2').value).toBe('Hotel „U Lípy“; 2 noci');
    expect(ws.getCell('E2').value).toBe(2380.5);
    expect(ws.getCell('E2').numFmt).toBe('#,##0.00');
    expect(ws.getCell('F2').value).toBe(24.422);
    // Datum a čas jako skutečné hodnoty data (místní čas bez posunu).
    expect((ws.getCell('C2').value as Date).toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect((ws.getCell('D2').value as Date).toISOString()).toBe('2026-10-14T06:30:00.000Z');
    expect((ws.getCell('D4').value as Date).toISOString()).toBe('2026-03-29T02:30:00.000Z');
    // Text začínající „=“ zůstane textem, ne vzorcem.
    expect(ws.getCell('B3').value).toBe('=HYPERLINK("http://x")');
    expect(ws.getCell('B3').type).toBe(ExcelJS.ValueType.String);
    expect(ws.getCell('B4').value).toBe('řádek\nnový <tag> & "uvozovky"');
    expect(ws.getCell('C3').value).toBeNull();
    expect(wb.getWorksheet('Souhrn   test')!.getCell('A2').value).toBe('Žluťoučký kůň');
  });

  it('neobsahuje makra ani vzorce a odstraní znaky, které XML nepovoluje', () => {
    const bytes = toXlsx([{ ...table, rows: [[1, 'a\u0001b', null, null, null, null]] }]);
    const files = unzipSync(bytes);
    expect(Object.keys(files).some((f) => /vba|macro/i.test(f))).toBe(false);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('>ab<');
  });
});
