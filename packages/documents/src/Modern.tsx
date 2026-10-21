// Moderní přehledný dokument: výsledek nahoře, souhrnné bloky, tabulky jen s vodorovnými linkami.
// Pozor: lineHeight na úrovni stránky v @react-pdf/renderer skryje pevné zápatí – nastavuje se jen u textů.
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
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

const Footer = ({ m }: { m: DocModel }) => (
  <View style={s.footer} fixed>
    <Text>Pravidla: {m.ruleSet}</Text>
    <Text>Vytvořeno {m.createdAt}</Text>
    <Text render={({ pageNumber, totalPages }) => `${m.number} · strana ${pageNumber}/${totalPages}`} />
  </View>
);

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
  return (
    <Page size="A4" style={s.page}>
      <Header m={m} part="Část A · Cestovní příkaz" />
      <Footer m={m} />
      <Text style={s.kicker}>{m.trip.kind.toUpperCase()} PRACOVNÍ CESTA</Text>
      <Text style={s.h1}>Cestovní příkaz</Text>
      <View style={s.row}>
        <Card label="Cíl" value={m.trip.destinations} sub={m.trip.via ? `přes ${m.trip.via}` : undefined} />
        <Card label="Termín (plán)" value={m.trip.plannedStart} sub={`do ${dash(m.trip.plannedEnd)}`} />
        <Card label="Záloha" value={m.trip.advances.join(', ') || 'bez zálohy'} last />
      </View>
      <Text style={s.h2}>Zaměstnanec</Text>
      <KV
        items={[
          ['Jméno a příjmení', dash(m.employee.name)],
          ['Osobní číslo', m.employee.personalNumber],
          ['Pracovní pozice', m.employee.position],
          ['Útvar', m.employee.department],
          ['Pravidelné pracoviště', dash(m.employee.regularWorkplace)],
          ['Adresa', m.employee.address],
        ]}
      />
      <Text style={s.h2}>Zaměstnavatel</Text>
      <KV
        items={[
          ['Název', dash(m.employer.name)],
          ['IČO', m.employer.ico],
          ['Sídlo', m.employer.seat],
          ['Organizační jednotka', m.employer.unit],
          ['Nákladové středisko', m.employer.costCenter],
          ['Projekt / zakázka', m.employer.project],
          ['Režim náhrad', m.employer.sector],
        ]}
      />
      <Text style={s.h2}>Pracovní cesta</Text>
      <KV
        items={[
          ['Účel', dash(m.trip.purpose)],
          ['Místo nástupu', dash(m.trip.startPlace)],
          ['Místo ukončení', dash(m.trip.endPlace)],
          ['Plánovaný začátek', dash(m.trip.plannedStart)],
          ['Plánovaný konec', dash(m.trip.plannedEnd)],
          ['Cílová místa', dash(m.trip.destinations)],
          ['Průjezdní místa', m.trip.via],
          ['Dopravní prostředek', dash(m.trip.transport)],
          ['Poznámka', m.trip.note],
          ['Vystaveno', [m.issued.place, m.issued.date].filter(Boolean).join(', ')],
        ]}
      />
      <Section title="Podpisy">
        <Signs
          items={[
            ['Zaměstnanec', 'Datum a podpis', <SignatureMark sig={m.signature} />],
            ['Schválil – zaměstnavatel / nadřízený', 'Jméno, datum a podpis'],
          ]}
        />
      </Section>
    </Page>
  );
}

export function PartB({ m }: { m: DocModel }) {
  const pd = m.perDiem;
  return (
    <Page size="A4" style={s.page}>
      <Header m={m} part="Část B · Vyúčtování a žádost o vyplacení" />
      <Footer m={m} />
      <Text style={s.kicker}>ŽÁDOST O VYPLACENÍ NÁHRAD</Text>
      <Text style={s.h1}>Vyúčtování pracovní cesty</Text>
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
        Průběh cesty · {m.actual.start} – {m.actual.end}
        {m.actual.km ? ` · ${m.actual.km}` : ''}
      </Text>
      <Table
        cols={[{ h: '#', w: 4 }, { h: 'Odkud – kam', w: 26 }, { h: 'Odjezd', w: 13 }, { h: 'Příjezd', w: 13 }, { h: 'Doprava', w: 14 }, { h: 'km', w: 6, right: true }, { h: 'Přechod hranice', w: 24 }]}
        rows={m.segments.map((x) => [x.n, `${x.from} – ${x.to}`, x.departure, x.arrival, x.transport, x.km, dash(x.border)])}
      />

      <Text style={s.h2}>Stravné po dnech</Text>
      {pd.hasForeign ? (
        <Table
          cols={[{ h: 'Den', w: 13 }, { h: 'ČR', w: 9 }, { h: 'Tuzemské', w: 10, right: true }, { h: 'Zahraničí', w: 10 }, { h: 'Stát · sazba', w: 15 }, { h: 'Pásmo', w: 8 }, { h: 'Jídla', w: 7 }, { h: 'Krácení', w: 14, right: true }, { h: 'Zahraniční', w: 14, right: true }]}
          rows={pd.days.map((d) => [d.date, d.domesticTime, dash(d.domesticAmount), d.foreignTime, d.country ? `${d.country} · ${d.base}` : '–', dash(d.tier), dash(d.meals), dash(d.reduction), dash(d.amount)])}
          foot={['Celkem', '', pd.domesticTotal, '', '', '', '', pd.reductionTotal, pd.foreignTotal]}
        />
      ) : (
        <Table
          cols={[{ h: 'Den', w: 18 }, { h: 'Doba', w: 14 }, { h: 'Pásmo a sazba', w: 34 }, { h: 'Jídla', w: 10 }, { h: 'Stravné', w: 24, right: true }]}
          rows={pd.days.map((d) => [d.date, d.domesticTime, dash(d.domestic), dash(d.meals), dash(d.domesticAmount)])}
          foot={['Celkem', '', '', '', pd.domesticTotal]}
        />
      )}
      <Text style={s.note}>{pd.note}</Text>

      {m.expenses.length > 0 && (
        <>
          <Text style={s.h2}>Výdaje</Text>
          <Table
            cols={[{ h: '#', w: 4 }, { h: 'Výdaj', w: 34 }, { h: 'Částka', w: 13, right: true }, { h: 'Kurz · zdroj', w: 17 }, { h: 'Kč', w: 12, right: true }, { h: 'Úhrada', w: 13 }, { h: 'Dokl.', w: 7, right: true }]}
            rows={m.expenses.map((e) => [e.n, [`${e.category}${e.supplier ? ` – ${e.supplier}` : ''}, ${e.date}`, e.description, e.note].filter(Boolean).join(' · '), e.amount, dash(e.rate), e.czk, e.payment, e.docs])}
          />
          <Text style={s.note}>{m.expensesNote}</Text>
        </>
      )}

      {m.vehicle && (
        <Section title={`Soukromé vozidlo · ${m.vehicle.vehicle}`}>
          <Table
            cols={[{ h: 'Složka náhrady', w: 40 }, { h: 'Výpočet', w: 40 }, { h: 'Kč', w: 20, right: true }]}
            rows={[
              ['Základní náhrada', m.vehicle.basicCalc, m.vehicle.basic],
              [`Pohonné hmoty (spotřeba ${m.vehicle.consumption})`, `${m.vehicle.fuelCalc} · ${m.vehicle.fuelPriceSource}`, m.vehicle.fuelComp],
            ]}
            foot={['Celkem', '', m.vehicle.total]}
          />
          <Text style={s.note}>
            Vlastník: {dash(m.vehicle.owner)} · palivo: {m.vehicle.fuel} · použito na žádost zaměstnavatele: {m.vehicle.requested}
          </Text>
        </Section>
      )}

      <Section title="Vyúčtování">
        <Table
          cols={[{ h: 'Položka', w: 60 }, { h: 'Cizí měna', w: 20, right: true }, { h: 'Kč', w: 20, right: true }]}
          rows={m.settlement.rows.map((r) => [r.label, r.foreign, r.czk])}
          foot={[`${m.settlement.payoutLabel} (zaokrouhleno na celé Kč)`, '', m.settlement.payout]}
        />
      </Section>

      <Section title="Prohlášení a schválení">
        <Text style={{ marginBottom: 3, lineHeight: 1.3 }}>{m.declaration}</Text>
        <Text style={{ marginBottom: 6, color: MUTED }}>Připojeno dokladů: {m.documentCount}</Text>
        <Signs
          items={[
            ['Zaměstnanec', 'Datum a podpis', <SignatureMark sig={m.signature} />],
            ['Věcná kontrola', 'Nadřízený – datum, podpis'],
            ['Účetní kontrola', 'Datum, podpis'],
            ['Schváleno k výplatě', 'Datum, podpis'],
          ]}
        />
      </Section>
    </Page>
  );
}

export function ModernDocument({ m, part }: { m: DocModel; part: DocPart }) {
  return (
    <Document title={`${m.number} Cestovní příkaz${part === 'full' ? ' a žádost o vyplacení' : ''}`} author={m.employee.name} language="cs" creator="Cestovní příkazy" producer="Cestovní příkazy">
      <PartA m={m} />
      {part === 'full' && <PartB m={m} />}
    </Document>
  );
}
