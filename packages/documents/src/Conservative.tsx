// Konzervativní formulářový dokument: rámečky a mřížka jako u tradičních tiskopisů, číslované oddíly.
import { Document, Page, StyleSheet, Text, View, type Styles } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { DocModel, DocPart } from './model.js';
import { SignatureMark } from './SignatureMark.js';

const B = '0.75pt solid #000';
const dash = (v: string) => v || '–';

const s = StyleSheet.create({
  page: { fontFamily: 'Noto Sans', fontSize: 8.5, paddingTop: 42, paddingBottom: 44, paddingHorizontal: 36, color: '#000' },
  header: { position: 'absolute', top: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5 },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, borderTop: '0.5pt solid #000', paddingTop: 3 },
  title: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 16, textAlign: 'center', marginBottom: 2 },
  subtitle: { textAlign: 'center', fontSize: 9, marginBottom: 10 },
  section: { border: B, marginBottom: 8 },
  sectionTitle: { backgroundColor: '#e6e6e6', borderBottom: B, paddingVertical: 2.5, paddingHorizontal: 5, fontWeight: 700, fontSize: 9 },
  row: { flexDirection: 'row' },
  cell: { borderRight: B, borderBottom: B, paddingVertical: 3, paddingHorizontal: 4 },
  label: { fontSize: 6.5, marginBottom: 1 },
  value: { fontSize: 9, lineHeight: 1.25 },
  th: { fontWeight: 700, fontSize: 7, backgroundColor: '#f2f2f2' },
  td: { fontSize: 7.8, lineHeight: 1.25 },
  right: { textAlign: 'right' },
  sign: { height: 68, justifyContent: 'flex-end', paddingHorizontal: 5, paddingBottom: 3 },
  signLabel: { borderTop: '0.5pt dotted #000', paddingTop: 2, fontSize: 7 },
  note: { fontSize: 7, paddingHorizontal: 5, paddingVertical: 3, lineHeight: 1.3 },
});

const Header = ({ m }: { m: DocModel }) => (
  <View style={s.header} fixed>
    <Text>{m.employer.name}</Text>
    <Text style={{ fontWeight: 700 }}>Cestovní příkaz č. {m.number}</Text>
  </View>
);
const Footer = ({ m }: { m: DocModel }) => (
  <View style={s.footer} fixed>
    <Text>
      {m.number} · Pravidla: {m.ruleSet}
    </Text>
    <Text>Vytvořeno {m.createdAt}</Text>
    <Text render={({ pageNumber, totalPages }) => `Strana ${pageNumber} z ${totalPages}`} />
  </View>
);

/** Mřížka polí s popiskem nad hodnotou. Šířky v procentech v rámci řádku. */
const Fields = ({ rows }: { rows: [string, string, number][][] }) => (
  <View>
    {rows.map((r, i) => (
      <View key={i} style={s.row} wrap={false}>
        {r.map(([label, value, w], j) => (
          <View key={j} style={[s.cell, { width: `${w}%` }, j === r.length - 1 ? { borderRight: 0 } : {}, i === rows.length - 1 ? { borderBottom: 0 } : {}]}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.value}>{value || ' '}</Text>
          </View>
        ))}
      </View>
    ))}
  </View>
);

type Col = { h: string; w: number; right?: boolean };
const Table = ({ cols, rows, foot }: { cols: Col[]; rows: string[][]; foot?: string[] }) => {
  const line = (cells: string[], style: Styles[string] | Styles[string][], key: string | number, last: boolean) => (
    <View key={key} style={s.row} wrap={false}>
      {cells.map((c, j) => (
        <Text key={j} style={[s.cell, ...(Array.isArray(style) ? style : [style]), { width: `${cols[j]!.w}%` }, cols[j]!.right ? s.right : {}, j === cells.length - 1 ? { borderRight: 0 } : {}, last ? { borderBottom: 0 } : {}]}>
          {c}
        </Text>
      ))}
    </View>
  );
  return (
    <View>
      {line(cols.map((c) => c.h), s.th, 'h', rows.length === 0 && !foot)}
      {rows.map((r, i) => line(r, s.td, i, !foot && i === rows.length - 1))}
      {foot && line(foot, [s.td, { fontWeight: 700 }], 'f', true)}
    </View>
  );
};

const Section = ({ n, title, children, wrap = true }: { n: number; title: string; children: ReactNode; wrap?: boolean }) => (
  <View style={s.section} wrap={wrap}>
    <Text style={s.sectionTitle}>
      {n}. {title}
    </Text>
    {children}
  </View>
);

/** Podpisová pole; první pole patří zaměstnanci a může obsahovat vložený podpis. */
const Signatures = ({ items, employee }: { items: string[]; employee?: DocModel['signature'] }) => (
  <View style={[s.row, { borderTop: B }]}>
    {items.map((t, i) => (
      <View key={t} style={[s.sign, { width: `${100 / items.length}%` }, i < items.length - 1 ? { borderRight: B } : {}]}>
        {i === 0 && <SignatureMark sig={employee} />}
        <Text style={s.signLabel}>{t}</Text>
      </View>
    ))}
  </View>
);

function PartA({ m }: { m: DocModel }) {
  return (
    <Page size="A4" style={s.page}>
      <Header m={m} />
      <Footer m={m} />
      <Text style={s.title}>CESTOVNÍ PŘÍKAZ</Text>
      <Text style={s.subtitle}>
        č. {m.number} · Část A – příkaz k pracovní cestě · {m.trip.kind} pracovní cesta
      </Text>
      <Section n={1} title="Zaměstnavatel">
        <Fields
          rows={[
            [['Název', m.employer.name, 50], ['IČO', m.employer.ico, 20], ['Režim náhrad', m.employer.sector, 30]],
            [['Sídlo', m.employer.seat, 50], ['Nákladové středisko', m.employer.costCenter, 20], ['Projekt / zakázka', m.employer.project, 30]],
          ]}
        />
      </Section>
      <Section n={2} title="Zaměstnanec">
        <Fields
          rows={[
            [['Jméno a příjmení', m.employee.name, 50], ['Osobní číslo', m.employee.personalNumber, 20], ['Útvar', m.employee.department, 30]],
            [['Pracovní pozice', m.employee.position, 50], ['Pravidelné pracoviště', m.employee.regularWorkplace, 50]],
          ]}
        />
      </Section>
      <Section n={3} title="Pracovní cesta">
        <Fields
          rows={[
            [['Účel cesty', m.trip.purpose, 100]],
            [['Místo nástupu', m.trip.startPlace, 25], ['Začátek (datum, hodina)', m.trip.plannedStart, 25], ['Místo ukončení', m.trip.endPlace, 25], ['Konec (datum, hodina)', m.trip.plannedEnd, 25]],
            [['Cílová místa', m.trip.destinations, 50], ['Průjezdní místa', m.trip.via, 50]],
            [['Dopravní prostředek', m.trip.transport, 50], ['Záloha', m.trip.advances.join(', ') || 'bez zálohy', 50]],
            ...(m.trip.note ? [[['Poznámka', m.trip.note, 100] as [string, string, number]]] : []),
          ]}
        />
      </Section>
      <Section n={4} title="Vystavení a schválení příkazu" wrap={false}>
        <Fields rows={[[['Místo vystavení', m.issued.place, 50], ['Datum vystavení', m.issued.date, 50]]]} />
        <Signatures items={['Podpis zaměstnance (souhlas s cestou)', 'Schválil – podpis zaměstnavatele / nadřízeného']} employee={m.signature} />
      </Section>
    </Page>
  );
}

function PartB({ m }: { m: DocModel }) {
  const pd = m.perDiem;
  // Oddíly bez obsahu (výdaje, vozidlo) se vynechají – číslování pokračuje bez mezer.
  let section = 4;
  const next = () => ++section;
  return (
    <Page size="A4" style={s.page}>
      <Header m={m} />
      <Footer m={m} />
      <Text style={s.title}>VYÚČTOVÁNÍ PRACOVNÍ CESTY</Text>
      <Text style={s.subtitle}>č. {m.number} · Část B – vyúčtování a žádost o vyplacení náhrad</Text>

      <Section n={next()} title="Skutečný průběh cesty">
        <Fields rows={[[['Skutečný začátek', m.actual.start, 30], ['Skutečný konec', m.actual.end, 30], ['Celkem km', m.actual.km, 40]]]} />
        <View style={{ borderTop: B }}>
          <Table
            cols={[{ h: '#', w: 4 }, { h: 'Odkud', w: 15 }, { h: 'Kam', w: 15 }, { h: 'Odjezd', w: 13 }, { h: 'Příjezd', w: 13 }, { h: 'Doprava', w: 12 }, { h: 'km', w: 6, right: true }, { h: 'Přechod hranice', w: 22 }]}
            rows={m.segments.map((x) => [x.n, x.from, x.to, x.departure, x.arrival, x.transport, x.km, dash(x.border)])}
          />
        </View>
      </Section>

      <Section n={next()} title="Stravné">
        {pd.hasForeign ? (
          <Table
            cols={[{ h: 'Den', w: 13 }, { h: 'V ČR / tuzemské', w: 15 }, { h: 'V zahraničí', w: 10 }, { h: 'Stát, sazba', w: 14 }, { h: 'Pásmo', w: 8 }, { h: 'Jídla', w: 8 }, { h: 'Krácení', w: 16, right: true }, { h: 'Stravné', w: 16, right: true }]}
            rows={pd.days.map((d) => [d.date, `${d.domesticTime} / ${dash(d.domesticAmount)}`, d.foreignTime, d.country ? `${d.country}, ${d.base}` : '–', dash(d.tier), dash(d.meals), dash(d.reduction), dash(d.amount)])}
            foot={['Celkem', pd.domesticTotal, '', '', '', '', pd.reductionTotal, pd.foreignTotal]}
          />
        ) : (
          <Table
            cols={[{ h: 'Den', w: 18 }, { h: 'Doba', w: 14 }, { h: 'Pásmo a sazba', w: 36 }, { h: 'Jídla', w: 10 }, { h: 'Stravné', w: 22, right: true }]}
            rows={pd.days.map((d) => [d.date, d.domesticTime, dash(d.domestic), dash(d.meals), dash(d.domesticAmount)])}
            foot={['Celkem', '', '', '', pd.domesticTotal]}
          />
        )}
        <Text style={[s.note, { borderTop: B }]}>{pd.note}</Text>
      </Section>

      {m.expenses.length > 0 && (
        <Section n={next()} title="Výdaje">
          <Table
            cols={[{ h: '#', w: 4 }, { h: 'Datum', w: 10 }, { h: 'Kategorie, popis, dodavatel', w: 28 }, { h: 'Částka', w: 12, right: true }, { h: 'Kurz, zdroj', w: 13 }, { h: 'Kč', w: 11, right: true }, { h: 'Úhrada', w: 14 }, { h: 'Dokl.', w: 8, right: true }]}
            rows={m.expenses.map((e) => [e.n, e.date, [e.category, e.description, e.supplier, e.note].filter(Boolean).join('; '), e.amount, dash(e.rate), e.czk, e.payment, e.docs])}
          />
          <Text style={[s.note, { borderTop: B }]}>{m.expensesNote}</Text>
        </Section>
      )}

      {m.vehicle && (
        <Section n={next()} title="Náhrada za použití soukromého vozidla" wrap={false}>
          <Fields
            rows={[
              [['Vozidlo', m.vehicle.vehicle, 35], ['Vlastník', m.vehicle.owner, 25], ['Palivo', m.vehicle.fuel, 20], ['Spotřeba', m.vehicle.consumption, 20]],
              [['Ujeto', m.vehicle.km, 15], ['Základní náhrada', `${m.vehicle.basicCalc} = ${m.vehicle.basic}`, 35], ['Náhrada za PHM', `${m.vehicle.fuelCalc} = ${m.vehicle.fuelComp}`, 30], ['Celkem', m.vehicle.total, 20]],
              [['Cena PHM', m.vehicle.fuelPriceSource, 50], ['Použito na žádost zaměstnavatele', m.vehicle.requested, 50]],
            ]}
          />
        </Section>
      )}

      <Section n={next()} title="Souhrn vyúčtování" wrap={false}>
        <Table
          cols={[{ h: 'Položka', w: 60 }, { h: 'Cizí měna', w: 20, right: true }, { h: 'Kč', w: 20, right: true }]}
          rows={m.settlement.rows.map((r) => [r.label, r.foreign, r.czk])}
          foot={[`${m.settlement.payoutLabel.toUpperCase()} (zaokrouhleno na celé Kč)`, '', m.settlement.payout]}
        />
        {m.employee.bankAccount ? <Text style={{ paddingHorizontal: 5, paddingVertical: 4, fontSize: 8 }}>Číslo účtu zaměstnance pro výplatu: {m.employee.bankAccount}</Text> : null}
      </Section>

      <Section n={next()} title="Prohlášení zaměstnance a schválení" wrap={false}>
        <Text style={{ padding: 5, fontSize: 8, lineHeight: 1.3 }}>{m.declaration}</Text>
        <Text style={{ paddingHorizontal: 5, paddingBottom: 4, fontSize: 8 }}>Počet připojených dokladů: {m.documentCount}</Text>
        <Signatures items={['Datum a podpis zaměstnance', 'Věcná kontrola – podpis nadřízeného', 'Účetní kontrola – podpis', 'Schváleno k výplatě – datum, podpis']} employee={m.signature} />
      </Section>
    </Page>
  );
}

export function ConservativeDocument({ m, part }: { m: DocModel; part: DocPart }) {
  return (
    <Document title={`${m.number} Cestovní příkaz${part === 'full' ? ' a žádost o vyplacení' : ''}`} author={m.employee.name} language="cs" creator="Cestovní příkazy" producer="Cestovní příkazy">
      <PartA m={m} />
      {part === 'full' && <PartB m={m} />}
    </Document>
  );
}
