// Soubory exportu pro stažení: XLSX, CSV v ZIP a JSON s úplnými daty cesty.

import { toCsv, toXlsx } from '@cp/documents/tabular';
import { strToU8, zipSync } from 'fflate';
import type { Attachment } from '../attachments/model.js';
import { SCHEMA_VERSION } from '../model/trip.js';
import { APP_VERSION } from '../version.js';
import { slug } from './names.js';
import { formulaTables } from './formulas.js';
import { buildTables, type TablesInput } from './tables.js';

const base = (input: TablesInput) => slug(input.trip.number, 'CP');

/** XLSX: souhrn, listy s celým výpočtem jako vzorci (pro kontrolu účetní) a datové listy jako v CSV. */
export function xlsxFile(input: TablesInput, now = new Date()) {
  const [summary, ...data] = buildTables(input);
  const tables = [summary!, ...formulaTables(input), ...data];
  return { name: `${base(input)}_Vyuctovani.xlsx`, bytes: toXlsx(tables, now), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

export function csvZipFile(input: TablesInput, now = new Date()) {
  const files = Object.fromEntries(buildTables(input).map((t) => [`${t.file}.csv`, strToU8(toCsv(t))]));
  return { name: `${base(input)}_CSV.zip`, bytes: zipSync(files, { mtime: now }), type: 'application/zip' };
}

/**
 * JSON s úplnou strukturou cesty, verzí schématu, metadaty příloh (bez obsahu souborů) a výsledkem výpočtu.
 * Slouží pro účetní systémy a archiv; pro pozdější pokračování v práci je určen pracovní projekt (ZIP).
 */
export function jsonFile(input: TablesInput, attachments: Attachment[], now = new Date()) {
  const { trip, result } = input;
  const data = {
    format: 'cestovni-prikazy-data',
    schemaVersion: SCHEMA_VERSION,
    applicationVersion: APP_VERSION,
    exportedAt: now.toISOString(),
    trip,
    attachments: attachments.map(({ tripId: _t, ...a }) => a),
    calculation: result ?? null,
  };
  return { name: `${base(input)}_data.json`, bytes: strToU8(JSON.stringify(data, null, 2)), type: 'application/json' };
}
