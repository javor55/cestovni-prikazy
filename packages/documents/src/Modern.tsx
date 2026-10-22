// Moderní přehledný dokument: výsledek nahoře, souhrnné bloky, tabulky jen s vodorovnými linkami.
// Pozor: lineHeight na úrovni stránky v @react-pdf/renderer skryje pevné zápatí – nastavuje se jen u textů.
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { labelsFor } from './labels.js';
import type { DocModel, DocPart } from './model.js';
import { SignatureMark } from './SignatureMark.js';

const INK = '#111';
const MUTED = '#555';
const RULE = '#bbb';
const TINT = '#efefef';
const dash = (v: string) => v || '–';

const s = StyleSheet.create({
  page: { fontFamily: 'Noto Sans', fontSize: 8.5, paddingTop: 60, paddingBottom: 46, paddingHorizontal: 40, color: INK },
  header: { position: 'absolute', top: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1.5pt solid ${INK}`, paddingBottom: 4 },
  footer: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.8, color: MUTED },
  kicker: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: MUTED, marginBottom: 2 },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  h2: { fontSize: 10.5, fontWeight: 700, marginTop: 12, marginBottom: 5 },
  row: { flexDirection: 'row' },
  card: { backgroundColor: TINT, padding: 8, marginRight: 6, flexGrow: 1, flexBasis: 0 },
  cardLabel: { fontSize: 7, color: MUTED, marginBottom: 2 },
  cardValue: { fontSize: 12, fontWeight: 700, lineHeight: 1.2 },
  cardSub: { fontSize: 7, color: MUTED, marginTop: 3, lineHeight: 1.2 },
  hero: { border: `1.5pt solid ${INK}`, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kv: { flexDirection: 'row', paddingVertical: 2.5, borderBottom: `0.5pt solid ${RULE}` },
  k: { width: '32%', color: MUTED },
  v: { width: '68%' },
  thRow: { borderBottom: `1pt solid ${INK}` },
  th: { fontSize: 7, fontWeight: 700, color: MUTED, paddingVertical: 3, paddingRight: 4 },
  tdRow: { borderBottom: `0.5pt solid ${RULE}` },
  td: { fontSize: 7.8, paddingVertical: 3, paddingRight: 4, lineHeight: 1.25 },
  tfRow: { borderTop: `1pt solid ${INK}` },
  tf: { fontSize: 8, fontWeight: 700, paddingVertical: 3, paddingRight: 4 },
  right: { textAlign: 'right' },
  note: { fontSize: 7, color: MUTED, marginTop: 4, lineHeight: 1.3 },
  signBox: { flexGrow: 1, flexBasis: 0, height: 72, border: `0.75pt solid ${INK}`, marginRight: 6, padding: 5, justifyContent: 'space-between' },
  signTitle: { fontSize: 7, fontWeight: 700 },
  signHint: { fontSize: 6.5, color: MUTED },
});

const Header = ({ m, part }: { m: DocModel; part: string }) => (
  <View style={s.header} fixed>
    <View>
      <Text style={{ fontSize: 7, color: MUTED }}>{m.employer.name}</Text>
      <Text style={{ fontSize: 8, fontWeight: 700 }}>{part}</Text>
    </View>
    <Text style={{ fontSize: 11, fontWeight: 700 }}>{m.number}</Text>
  </View>
);

const Footer = ({ m }: { m: DocModel }) => {
  const L = labelsFor(m);
  return (
    <View style={s.footer} fixed>
      <Text>
        {L.ruleSet}: {m.ruleSet}
      </Text>
      <Text>
        {L.created} {m.createdAt}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `${m.number} · ${L.page(pageNumber, totalPages)}`} />
    </View>
  );
};

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
    <View style={[s.row, s.thRow]}>
      {cols.map((c, j) => (
        <Text key={j} style={[s.th, { width: `${c.w}%` }, c.right ? s.right : {}]}>
          {c.h}
        </Text>
      ))}
    </View>
    {rows.map((r, i) => (
      <View key={i} style={[s.row, s.tdRow]} wrap={false}>
        {r.map((c, j) => (
          <Text key={j} style={[s.td, { width: `${cols[j]!.w}%` }, cols[j]!.right ? s.right : {}]}>
            {c}
          </Text>
        ))}
      </View>
    ))}
    {foot && (
      <View style={[s.row, s.tfRow]} wrap={false}>
        {foot.map((c, j) => (
          <Text key={j} style={[s.tf, { width: `${cols[j]!.w}%` }, cols[j]!.right ? s.right : {}]}>
            {c}
          </Text>
        ))}
      </View>
    )}
  </View>
);

const Card = ({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) => (
  <View style={[s.card, last ? { marginRight: 0 } : {}]}>
    <Text style={s.cardLabel}>{label}</Text>
    <Text style={s.cardValue}>{dash(value)}</Text>
    {sub ? <Text style={s.cardSub}>{sub}</Text> : null}
  </View>
);

const Signs = ({ items }: { items: [string, string, ReactNode?][] }) => (
  <View style={s.row} wrap={false}>
    {items.map(([t, h, content], i) => (
      <View key={t} style={[s.signBox, i === items.length - 1 ? { marginRight: 0 } : {}]}>
        <Text style={s.signTitle}>{t}</Text>
        {content}
        <Text style={s.signHint}>{h}</Text>
      </View>
    ))}
  </View>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <View wrap={false}>
    <Text style={s.h2}>{title}</Text>
    {children}
  </View>
);

export function PartA({ m }: { m: DocModel }) {
  const L = labelsFor(m);
  return (
    <Page size="A4" style={s.page}>
      <Header m={m} part={L.partA} />
      <Footer m={m} />
      <Text style={s.kicker}>{L.tripKicker(m.trip.kind)}</Text>
      <Text style={s.h1}>{L.travelOrder}</Text>
      <View style={s.row}>
        <Card label={L.destination} value={m.trip.destinations} sub={m.trip.via ? L.via(m.trip.via) : undefined} />
        <Card label={L.plannedTerm} value={m.trip.plannedStart} sub={L.until(dash(m.trip.plannedEnd))} />
        <Card label={L.advance} value={m.trip.advances.join(', ') || L.noAdvance} last />
      </View>
      <Text style={s.h2}>{L.employee}</Text>
      <KV
        items={[
          [L.name, dash(m.employee.name)],
          [L.personalNumber, m.employee.personalNumber],
          [L.position, m.employee.position],
          [L.department, m.employee.department],
          [L.regularWorkplace, dash(m.employee.regularWorkplace)],
          [L.address, m.employee.address],
        ]}
      />
      <Text style={s.h2}>{L.employer}</Text>
      <KV
        items={[
          [L.employerName, dash(m.employer.name)],
          [L.ico, m.employer.ico],
          [L.seat, m.employer.seat],
          [L.unit, m.employer.unit],
          [L.costCenter, m.employer.costCenter],
          [L.project, m.employer.project],
          [L.sector, m.employer.sector],
        ]}
      />
      <Text style={s.h2}>{L.trip}</Text>
      <KV
        items={[
          [L.purpose, dash(m.trip.purpose)],
          [L.startPlace, dash(m.trip.startPlace)],
          [L.endPlace, dash(m.trip.endPlace)],
          [L.plannedStart, dash(m.trip.plannedStart)],
          [L.plannedEnd, dash(m.trip.plannedEnd)],
          [L.destinations, dash(m.trip.destinations)],
          [L.viaPlaces, m.trip.via],
          [L.transport, dash(m.trip.transport)],
          [L.note, m.trip.note],
          [L.issued, [m.issued.place, m.issued.date].filter(Boolean).join(', ')],
        ]}
      />
      <Section title={L.signatures}>
        <Signs
          items={[
            [L.employee, L.dateSignature, <SignatureMark sig={m.signature} label={L.signed} />],
            [L.approvedEmployer, L.nameDateSignature],
          ]}
        />
      </Section>
    </Page>
  );
}

export function PartB({ m }: { m: DocModel }) {
  const pd = m.perDiem;
  const L = labelsFor(m);
  return (
    <Page size="A4" style={s.page}>
      <Header m={m} part={L.partB} />
      <Footer m={m} />
      <Text style={s.kicker}>{L.claimKicker}</Text>
      <Text style={s.h1}>{L.settlementTitle}</Text>
      <View style={s.hero} wrap={false}>
        <View>
          <Text style={{ fontSize: 8, color: MUTED }}>{m.settlement.payoutLabel}</Text>
          <Text style={{ fontSize: 22, fontWeight: 700 }}>{m.settlement.payout}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {m.settlement.headline.map((r) => (
            <Text key={r.label} style={{ fontSize: 7.5, color: MUTED }}>
              {r.label} {r.value}
            </Text>
          ))}
        </View>
      </View>

      <Text style={s.h2}>
        {L.course} · {m.actual.start} – {m.actual.end}
        {m.actual.km ? ` · ${m.actual.km}` : ''}
      </Text>
      <Table
        cols={[{ h: '#', w: 4 }, { h: L.segFromTo, w: 26 }, { h: L.departure, w: 13 }, { h: L.arrival, w: 13 }, { h: L.transportShort, w: 14 }, { h: 'km', w: 6, right: true }, { h: L.border, w: 24 }]}
        rows={m.segments.map((x) => [x.n, `${x.from} – ${x.to}`, x.departure, x.arrival, x.transport, x.km, dash(x.border)])}
      />

      <Text style={s.h2}>{L.perDiemDays}</Text>
      {pd.hasForeign ? (
        <Table
          cols={[{ h: L.day, w: 13 }, { h: L.czShort, w: 9 }, { h: L.domestic, w: 10, right: true }, { h: L.abroad, w: 10 }, { h: L.countryRate, w: 15 }, { h: L.tier, w: 8 }, { h: L.meals, w: 7 }, { h: L.reduction, w: 14, right: true }, { h: L.foreign, w: 14, right: true }]}
          rows={pd.days.map((d) => [d.date, d.domesticTime, dash(d.domesticAmount), d.foreignTime, d.country ? `${d.country} · ${d.base}` : '–', dash(d.tier), dash(d.meals), dash(d.reduction), dash(d.amount)])}
          foot={[L.total, '', pd.domesticTotal, '', '', '', '', pd.reductionTotal, pd.foreignTotal]}
        />
      ) : (
        <Table
          cols={[{ h: L.day, w: 18 }, { h: L.duration, w: 14 }, { h: L.bandRate, w: 34 }, { h: L.meals, w: 10 }, { h: L.perDiem, w: 24, right: true }]}
          rows={pd.days.map((d) => [d.date, d.domesticTime, dash(d.domestic), dash(d.meals), dash(d.domesticAmount)])}
          foot={[L.total, '', '', '', pd.domesticTotal]}
        />
      )}
      <Text style={s.note}>{pd.note}</Text>

      {m.expenses.length > 0 && (
        <>
          <Text style={s.h2}>{L.expenses}</Text>
          <Table
            cols={[{ h: '#', w: 4 }, { h: L.expense, w: 34 }, { h: L.amount, w: 13, right: true }, { h: L.rateSource, w: 17 }, { h: L.czk, w: 12, right: true }, { h: L.payment, w: 13 }, { h: L.docs, w: 7, right: true }]}
            rows={m.expenses.map((e) => [e.n, [`${e.category}${e.supplier ? ` – ${e.supplier}` : ''}, ${e.date}`, e.description, e.note].filter(Boolean).join(' · '), e.amount, dash(e.rate), e.czk, e.payment, e.docs])}
          />
          <Text style={s.note}>{m.expensesNote}</Text>
        </>
      )}

      {m.vehicle && (
        <Section title={L.vehicle(m.vehicle.vehicle)}>
          <Table
            cols={[{ h: L.component, w: 40 }, { h: L.calculation, w: 40 }, { h: L.czk, w: 20, right: true }]}
            rows={[
              [L.basic, m.vehicle.basicCalc, m.vehicle.basic],
              [L.fuel(m.vehicle.consumption), `${m.vehicle.fuelCalc} · ${m.vehicle.fuelPriceSource}`, m.vehicle.fuelComp],
            ]}
            foot={[L.total, '', m.vehicle.total]}
          />
          <Text style={s.note}>{L.vehicleNote(dash(m.vehicle.owner), m.vehicle.fuel, m.vehicle.requested)}</Text>
        </Section>
      )}

      <Section title={L.settlement}>
        <Table
          cols={[{ h: L.item, w: 60 }, { h: L.foreignCurrency, w: 20, right: true }, { h: L.czk, w: 20, right: true }]}
          rows={m.settlement.rows.map((r) => [r.label, r.foreign, r.czk])}
          foot={[L.rounded(m.settlement.payoutLabel), '', m.settlement.payout]}
        />
        <Text style={[s.note, { color: INK, fontSize: 8 }]}>{m.employee.bankAccount ? L.bankAccount(m.employee.bankAccount) : L.bankAccountMissing}</Text>
      </Section>

      <Section title={L.declarationTitle}>
        <Text style={{ marginBottom: 3, lineHeight: 1.3 }}>{m.declaration}</Text>
        <Text style={{ marginBottom: 6, color: MUTED }}>{L.attached(m.documentCount)}</Text>
        <Signs
          items={[
            [L.employee, L.dateSignature, <SignatureMark sig={m.signature} label={L.signed} />],
            [L.approvedSupervisor, L.nameDateSignature],
          ]}
        />
      </Section>
    </Page>
  );
}

export function ModernDocument({ m, part }: { m: DocModel; part: DocPart }) {
  const L = labelsFor(m);
  return (
    <Document title={L.title(m.number, part)} author={m.employee.name} language={m.lang ?? 'cs'} creator="Cestovní příkazy" producer="Cestovní příkazy">
      <PartA m={m} />
      {part === 'full' && <PartB m={m} />}
    </Document>
  );
}
