// Tabulkové exporty: stejná data jako XLSX (jeden sešit, více listů) i jako CSV (soubor na tabulku).
// XLSX se skládá ručně ze SpreadsheetML – bez velké knihovny a bez maker. Vzorce jen tam, kde je tabulka
// výslovně obsahuje (listy s výpočtem pro kontrolu účetní); text se nikdy jako vzorec nevyhodnotí.

import { strToU8, zipSync, type Zippable } from 'fflate';

/**
 * text = řetězec, amount = částka v jednotkách měny (2 desetinná místa), number = obecné číslo,
 * integer = celé číslo, date = „RRRR-MM-DD“, datetime = místní čas „RRRR-MM-DDTHH:mm“.
 */
export type ColumnType = 'text' | 'amount' | 'number' | 'integer' | 'date' | 'datetime';
/** Vzorec v XLSX s hodnotou spočítanou aplikací (zobrazí se i bez přepočtu, v CSV se zapíše jen hodnota). */
export interface Formula {
  /** Vzorec bez úvodního „=“, anglické názvy funkcí a desetinná tečka (tak je XLSX ukládá vždy). */
  f: string;
  v: number | string;
}
export type Cell = string | number | null | Formula;

export const formula = (f: string, v: number | string): Formula => ({ f, v });

export interface Column {
  /** Název sloupce v záhlaví. */
  header: string;
  type: ColumnType;
  /** Šířka sloupce v XLSX ve znacích. */
  width?: number;
}

export interface Table {
  /** Název listu v XLSX (nejvýš 31 znaků) a základ názvu CSV souboru. */
  name: string;
  /** Název CSV souboru bez přípony, např. „vydaje“. */
  file: string;
  columns: Column[];
  rows: Cell[][];
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isDateTime = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

/** Text, který by tabulkový procesor mohl vyhodnotit jako vzorec, dostane na začátek apostrof. */
function defuse(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function csvValue(cell: Cell, type: ColumnType): string {
  const v = cell !== null && typeof cell === 'object' ? cell.v : cell;
  if (v === null || v === '') return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    if (type === 'amount') return v.toFixed(2);
    if (type === 'integer') return String(Math.round(v));
    return String(v);
  }
  const s = type === 'text' ? defuse(v) : v;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV podle zadání: UTF-8 s BOM (aby Excel poznal kódování), oddělovač středník, řádky CRLF,
 * data a časy ve formátu ISO 8601, částky s desetinnou tečkou bez symbolu měny.
 */
export function toCsv(table: Table): string {
  const lines = [table.columns.map((c) => csvValue(c.header, 'text')).join(';')];
  for (const row of table.rows) lines.push(table.columns.map((c, i) => csvValue(row[i] ?? null, c.type)).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

// --- XLSX ---

const xmlEscape = (s: string) =>
  s
    // Znaky, které XML 1.0 nepovoluje.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Pořadové číslo dne v Excelu (1900, bez časového pásma – místní čas se zapíše tak, jak je). */
function serial(s: string): number {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number) as [number, number, number];
  const days = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
  if (s.length === 10) return days;
  const [hh, mm] = s.slice(11, 16).split(':').map(Number) as [number, number];
  return days + (hh * 60 + mm) / 1440;
}

// Styly (pořadí odpovídá cellXfs ve styles.xml).
const STYLE = { header: 1, amount: 2, date: 3, datetime: 4, integer: 5 } as const;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="d.m.yyyy"/><numFmt numFmtId="165" formatCode="d.m.yyyy h:mm"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cellXml(ref: string, v: Cell, type: ColumnType): string {
  if (v !== null && typeof v === 'object') {
    const s = type === 'amount' ? STYLE.amount : type === 'integer' ? STYLE.integer : 0;
    const value = typeof v.v === 'number' ? (Number.isFinite(v.v) ? `<v>${v.v}</v>` : '') : `<v>${xmlEscape(v.v)}</v>`;
    return `<c r="${ref}"${s ? ` s="${s}"` : ''}${typeof v.v === 'string' ? ' t="str"' : ''}><f>${xmlEscape(v.f)}</f>${value}</c>`;
  }
  if (v === null || v === '') return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    const s = type === 'amount' ? STYLE.amount : type === 'integer' ? STYLE.integer : 0;
    return `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`;
  }
  if (type === 'date' && isDate(v)) return `<c r="${ref}" s="${STYLE.date}"><v>${serial(v)}</v></c>`;
  if (type === 'datetime' && isDateTime(v)) return `<c r="${ref}" s="${STYLE.datetime}"><v>${serial(v)}</v></c>`;
  // Řetězce se zapisují přímo do buňky (inlineStr) – nikdy jako vzorec.
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
}

function sheetXml(t: Table): string {
  const header = t.columns.map((c, i) => `<c r="${colName(i)}1" t="inlineStr" s="${STYLE.header}"><is><t xml:space="preserve">${xmlEscape(c.header)}</t></is></c>`).join('');
  const rows = t.rows.map((row, r) => `<row r="${r + 2}">${t.columns.map((c, i) => cellXml(`${colName(i)}${r + 2}`, row[i] ?? null, c.type)).join('')}</row>`);
  const cols = t.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? Math.max(10, Math.min(40, c.header.length + 2))}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData><row r="1">${header}</row>${rows.join('')}</sheetData></worksheet>`;
}

/** Název listu: nejvýš 31 znaků, bez znaků, které Excel v názvu listu nepovoluje, a jedinečný. */
function sheetNames(tables: Table[]): string[] {
  const used = new Set<string>();
  return tables.map((t, i) => {
    let name = t.name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `List${i + 1}`;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${i + 1}`;
    used.add(name.toLowerCase());
    return name;
  });
}

/** Sešit XLSX s jedním listem na tabulku. Datum vytvoření je v metadatech sešitu. */
export function toXlsx(tables: Table[], created = new Date()): Uint8Array {
  const names = sheetNames(tables);
  const files: Zippable = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${tables
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Cestovní příkazy</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created.toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets>${tables.some((t) => t.rows.some((r) => r.some((c) => c !== null && typeof c === 'object'))) ? '<calcPr calcId="191029" fullCalcOnLoad="1"/>' : ''}</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
  };
  tables.forEach((t, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(t))));
  return zipSync(files, { level: 6, mtime: created });
}
