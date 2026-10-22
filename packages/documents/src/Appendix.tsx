// Stránky, které kompletní dokumentace přidává kolem podepsaného dokumentu: krycí list a obsah,
// přehled výdajů a identifikační stránky výdajů.
// Zápatí s průběžným číslováním doplňuje až sestavení (assemble.ts) – proto mají stránky dole volný okraj.
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { DocModel } from './model.js';

const INK = '#111';
const MUTED = '#555';
const RULE = '#bbb';
const dash = (v: string) => v || '–';

const s = StyleSheet.create({
  page: { fontFamily: 'Noto Sans', fontSize: 9, paddingTop: 40, paddingBottom: 44, paddingHorizontal: 40, color: INK },
  kicker: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: MUTED, marginBottom: 2 },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 10 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 12, marginBottom: 5 },
  row: { flexDirection: 'row' },
  kv: { flexDirection: 'row', paddingVertical: 3, borderBottom: `0.5pt solid ${RULE}` },
  k: { width: '35%', color: MUTED },
  v: { width: '65%' },
  thRow: { flexDirection: 'row', borderBottom: `1pt solid ${INK}` },
  th: { fontSize: 7, fontWeight: 700, color: MUTED, paddingVertical: 3, paddingRight: 4 },
  tdRow: { flexDirection: 'row', borderBottom: `0.5pt solid ${RULE}` },
  td: { fontSize: 8, paddingVertical: 3, paddingRight: 4 },
  tfRow: { flexDirection: 'row', borderTop: `1pt solid ${INK}` },
  tf: { fontSize: 8, fontWeight: 700, paddingVertical: 3, paddingRight: 4 },
  right: { textAlign: 'right' },
  note: { fontSize: 7.5, color: MUTED, marginTop: 4 },
  box: { border: `1.5pt solid ${INK}`, padding: 10, marginTop: 8 },
});

const KV = ({ items }: { items: [string, string][] }) => (
  <View>
    {items
      .filter(([, v]) => v)
      .map(([k, v]) => (
        <View key={k} style={s.kv} wrap={false}>
          <Text style={s.k}>{k}</Text>
          <Text style={s.v}>{v}</Text>
        </View>
      ))}
  </View>
);

type Col = { h: string; w: number; right?: boolean };
const Table = ({ cols, rows, foot }: { cols: Col[]; rows: string[][]; foot?: string[] }) => (
  <View>
    <View style={s.thRow} fixed>
      {cols.map((c, j) => (
        <Text key={j} style={[s.th, { width: `${c.w}%` }, c.right ? s.right : {}]}>
          {c.h}
        </Text>
      ))}
    </View>
    {rows.map((r, i) => (
      <View key={i} style={s.tdRow} wrap={false}>
        {r.map((c, j) => (
          <Text key={j} style={[s.td, { width: `${cols[j]!.w}%` }, cols[j]!.right ? s.right : {}]}>
            {c}
          </Text>
        ))}
      </View>
    ))}
    {foot && (
      <View style={s.tfRow} wrap={false}>
        {foot.map((c, j) => (
          <Text key={j} style={[s.tf, { width: `${cols[j]!.w}%` }, cols[j]!.right ? s.right : {}]}>
            {c}
          </Text>
        ))}
      </View>
    )}
  </View>
);

const Doc = ({ m, children }: { m: DocModel; children: ReactNode }) => (
  <Document title={`${m.number} Kompletní dokumentace`} author={m.employee.name} language="cs">
    {children}
  </Document>
);

export interface TocEntry {
  title: string;
  page: number;
  /** 0 = oddíl, 1 = výdaj, 2 = příloha */
  level: 0 | 1 | 2;
}

export interface CoverInfo {
  totalPages: number;
  signature: string;
  accountingDocs: number;
  paymentDocs: number;
  supportingDocs: number;
  vehicleDocs: number;
  expensesWithoutDocs: number;
  problems: string[];
}

export function CoverAndToc({ m, toc, info }: { m: DocModel; toc: TocEntry[]; info: CoverInfo }) {
  return (
    <Doc m={m}>
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>{m.employer.name.toUpperCase()}</Text>
        <Text style={s.h1}>Kompletní dokumentace pracovní cesty</Text>
        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{m.number}</Text>
        <KV
          items={[
            ['Zaměstnanec', dash(m.employee.name)],
            ['Účel cesty', dash(m.trip.purpose)],
            ['Druh cesty', m.trip.kind],
            ['Skutečný průběh', `${m.actual.start} – ${m.actual.end}`],
            ['Cílová místa', m.trip.destinations],
            [m.settlement.payoutLabel, m.settlement.payout],
            ['Podpis', info.signature],
            ['Pravidla výpočtu', m.ruleSet],
            ['Vytvořeno', m.createdAt],
          ]}
        />
        <View style={s.box}>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Obsah balíčku</Text>
          <Text>Celkem stran: {info.totalPages}</Text>
          <Text>Účetní doklady: {info.accountingDocs}</Text>
          <Text>Doklady o zaplacení: {info.paymentDocs}</Text>
          <Text>Doplňující dokumenty: {info.supportingDocs}</Text>
          {info.vehicleDocs > 0 && <Text>Doklady k vozidlu: {info.vehicleDocs}</Text>}
          <Text>Výdaje bez přiloženého dokladu: {info.expensesWithoutDocs}</Text>
        </View>
        {info.problems.length > 0 && (
          <View style={[s.box, { borderColor: '#000', borderStyle: 'dashed' }]}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Upozornění</Text>
            {info.problems.map((p) => (
              <Text key={p}>• {p}</Text>
            ))}
          </View>
        )}
      </Page>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Obsah a seznam příloh</Text>
        {toc.map((e, i) => (
          <View key={i} style={[s.row, { paddingVertical: e.level === 0 ? 3 : 1.5, marginTop: e.level === 0 && i > 0 ? 4 : 0 }]} wrap={false}>
            <Text style={{ flexGrow: 1, flexBasis: 0, paddingLeft: e.level * 12, fontWeight: e.level === 0 ? 700 : 400, fontSize: e.level === 2 ? 8 : 9 }}>{e.title}</Text>
            <Text style={{ width: 50, textAlign: 'right', fontSize: e.level === 2 ? 8 : 9 }}>{e.page}</Text>
          </View>
        ))}
      </Page>
    </Doc>
  );
}

export function ExpenseOverview({ m }: { m: DocModel }) {
  return (
    <Doc m={m}>
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>{m.number}</Text>
        <Text style={s.h1}>Přehled výdajů</Text>
        {m.expenses.length === 0 ? (
          <Text>K cestě nejsou zadány žádné výdaje.</Text>
        ) : (
          <Table
            cols={[{ h: '#', w: 4 }, { h: 'Datum', w: 10 }, { h: 'Výdaj', w: 28 }, { h: 'Částka', w: 12, right: true }, { h: 'Kurz', w: 15 }, { h: 'Kč', w: 11, right: true }, { h: 'Úhrada', w: 13 }, { h: 'Dokl.', w: 7, right: true }]}
            rows={m.expenses.map((e) => [e.n, e.date, [e.category, e.supplier, e.description, e.note].filter(Boolean).join(' · '), e.amount, dash(e.rate), e.czk, e.payment, e.docs])}
          />
        )}
        <Text style={s.note}>{m.expensesNote}</Text>
      </Page>
    </Doc>
  );
}

export interface IdPageFile {
  kind: string;
  name: string;
  pages: number;
}

/** Identifikační stránka před doklady každého výdaje (zadání § 19.3). */
export function ExpenseIdPages({ m, files }: { m: DocModel; files: Record<string, IdPageFile[]> }) {
  return (
    <Doc m={m}>
      {m.expenses.map((e) => (
        <Page key={e.n} size="A4" style={s.page}>
          <Text style={s.kicker}>
            {m.number} · VÝDAJ {e.n} Z {m.expenses.length}
          </Text>
          <Text style={s.h1}>
            Výdaj č. {e.n} · {e.category}
          </Text>
          <KV
            items={[
              ['Popis', dash(e.description)],
              ['Dodavatel', dash(e.supplier)],
              ['Datum', dash(e.date)],
              ['Částka a měna', e.amount],
              ['Kurz', dash(e.rate)],
              ['Částka v Kč', `${e.czk} Kč`],
              ['Způsob úhrady', e.payment],
              ['Poznámka', e.note],
            ]}
          />
          <Text style={s.h2}>Následující přílohy</Text>
          {(files[e.n] ?? []).length === 0 ? (
            <Text style={{ fontWeight: 700 }}>K výdaji není přiložen žádný doklad.</Text>
          ) : (
            <Table cols={[{ h: '#', w: 6 }, { h: 'Typ', w: 28 }, { h: 'Soubor', w: 51 }, { h: 'Stran', w: 15, right: true }]} rows={(files[e.n] ?? []).map((f, i) => [String(i + 1), f.kind, f.name, String(f.pages)])} />
          )}
        </Page>
      ))}
    </Doc>
  );
}
