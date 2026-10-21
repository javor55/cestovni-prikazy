// Návrh 2 – moderní přehledný dokument se souhrnnými bloky.
// Výsledek nahoře, tabulky jen s vodorovnými linkami, šedé tóny čitelné i černobíle.
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { money, num, rate, sampleNotice } from './common.js';
import { trip, segments, perDiem, expenses, vehicle, summary, advance, ruleSet, declaration } from './data.js';

const INK = '#111';
const MUTED = '#555';
const RULE = '#bbb';
const TINT = '#efefef';

const s = StyleSheet.create({
  page: { fontFamily: 'Noto Sans', fontSize: 8.5, paddingTop: 60, paddingBottom: 44, paddingHorizontal: 40, color: INK },
  header: { position: 'absolute', top: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1.5pt solid ${INK}`, paddingBottom: 4 },
  headerNo: { fontSize: 11, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.8, color: MUTED },
  kicker: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: MUTED, marginBottom: 2 },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  h2: { fontSize: 10.5, fontWeight: 700, marginTop: 12, marginBottom: 5 },
  row: { flexDirection: 'row' },
  card: { backgroundColor: TINT, padding: 8, marginRight: 6, flexGrow: 1, flexBasis: 0 },
  cardLast: { marginRight: 0 },
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
  td: { fontSize: 7.8, paddingVertical: 3, paddingRight: 4 },
  tfRow: { borderTop: `1pt solid ${INK}` },
  tf: { fontSize: 8, fontWeight: 700, paddingVertical: 3, paddingRight: 4 },
  right: { textAlign: 'right' },
  note: { fontSize: 7, color: MUTED, marginTop: 4 },
  signBox: { flexGrow: 1, flexBasis: 0, height: 72, border: `0.75pt solid ${INK}`, marginRight: 6, padding: 5, justifyContent: 'space-between' },
  signTitle: { fontSize: 7, fontWeight: 700 },
  signHint: { fontSize: 6.5, color: MUTED },
});

const Header = ({ part }: { part: string }) => (
  <View style={s.header} fixed>
    <View>
      <Text style={{ fontSize: 7, color: MUTED }}>{trip.employer.name}</Text>
      <Text style={{ fontSize: 8, fontWeight: 600 }}>{part}</Text>
    </View>
    <Text style={s.headerNo}>{trip.number}</Text>
  </View>
);
const Footer = () => (
  <View style={s.footer} fixed>
    <Text>Pravidla: {ruleSet.id} v{ruleSet.version}</Text>
    <Text>{sampleNotice}</Text>
    <Text render={({ pageNumber, totalPages }) => `${trip.number} · strana ${pageNumber}/${totalPages}`} />
  </View>
);

const KV = ({ items }: { items: [string, string][] }) => (
  <View>
    {items.map(([k, v], i) => (
      <View key={i} style={s.kv} wrap={false}>
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
          <Text key={j} style={[s.td, { width: `${cols[j].w}%` }, cols[j].right ? s.right : {}]}>
            {c}
          </Text>
        ))}
      </View>
    ))}
    {foot && (
      <View style={[s.row, s.tfRow]} wrap={false}>
        {foot.map((c, j) => (
          <Text key={j} style={[s.tf, { width: `${cols[j].w}%` }, cols[j].right ? s.right : {}]}>
            {c}
          </Text>
        ))}
      </View>
    )}
  </View>
);

const Card = ({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) => (
  <View style={[s.card, last ? s.cardLast : {}]}>
    <Text style={s.cardLabel}>{label}</Text>
    <Text style={s.cardValue}>{value}</Text>
    {sub && <Text style={s.cardSub}>{sub}</Text>}
  </View>
);

const SignBox = ({ title, hint, last }: { title: string; hint: string; last?: boolean }) => (
  <View style={[s.signBox, last ? { marginRight: 0 } : {}]}>
    <Text style={s.signTitle}>{title}</Text>
    <Text style={s.signHint}>{hint}</Text>
  </View>
);

const meals = (m: { b: boolean; l: boolean; d: boolean }) => [m.b && 'S', m.l && 'O', m.d && 'V'].filter(Boolean).join(' + ') || '–';

export const Moderni = () => (
  <Document title={`${trip.number} Cestovní příkaz a žádost o vyplacení`} author={trip.employee.name} language="cs">
    {/* ČÁST A */}
    <Page size="A4" style={s.page}>
      <Header part="Část A · Cestovní příkaz" />
      <Footer />
      <Text style={s.kicker}>{trip.kind.toUpperCase()} PRACOVNÍ CESTA</Text>
      <Text style={s.h1}>Cestovní příkaz</Text>

      <View style={s.row}>
        <Card label="Cíl" value={trip.plan.destinations} sub={`přes ${trip.plan.via}`} />
        <Card label="Termín" value="14.–16. 10. 2026" sub="06:30 – 19:00 (plán)" />
        <Card label="Záloha" value={money(advance.amount, advance.currency)} sub={`vyplacena ${advance.providedOn}`} last />
      </View>

      <Text style={s.h2}>Zaměstnanec</Text>
      <KV
        items={[
          ['Jméno a příjmení', trip.employee.name],
          ['Osobní číslo · útvar', `${trip.employee.personalNumber} · ${trip.employee.department}`],
          ['Pracovní pozice', trip.employee.position],
          ['Pravidelné pracoviště', trip.employee.regularWorkplace],
        ]}
      />

      <Text style={s.h2}>Zaměstnavatel</Text>
      <KV
        items={[
          ['Název · IČO', `${trip.employer.name} · ${trip.employer.ico}`],
          ['Sídlo', trip.employer.seat],
          ['Nákladové středisko · zakázka', `${trip.employer.costCenter} · ${trip.employer.project}`],
          ['Režim náhrad', trip.sector],
        ]}
      />

      <Text style={s.h2}>Pracovní cesta</Text>
      <KV
        items={[
          ['Účel', trip.purpose],
          ['Nástup', `${trip.plan.startPlace}, ${trip.plan.start}`],
          ['Ukončení', `${trip.plan.endPlace}, ${trip.plan.end}`],
          ['Cílová místa', trip.plan.destinations],
          ['Průjezdní místa', trip.plan.via],
          ['Dopravní prostředek', trip.plan.transport],
          ['Vystaveno', `${trip.issuedPlace}, ${trip.issuedDate}`],
        ]}
      />

      <Text style={s.h2}>Podpisy</Text>
      <View style={s.row} wrap={false}>
        <SignBox title="Zaměstnanec" hint="Datum a podpis" />
        <SignBox title="Schválil – zaměstnavatel / nadřízený" hint="Jméno, datum a podpis" last />
      </View>
    </Page>

    {/* ČÁST B */}
    <Page size="A4" style={s.page}>
      <Header part="Část B · Vyúčtování a žádost o vyplacení" />
      <Footer />
      <Text style={s.kicker}>ŽÁDOST O VYPLACENÍ NÁHRAD</Text>
      <Text style={s.h1}>Vyúčtování pracovní cesty</Text>

      <View style={s.hero} wrap={false}>
        <View>
          <Text style={{ fontSize: 8, color: MUTED }}>K výplatě zaměstnanci</Text>
          <Text style={{ fontSize: 22, fontWeight: 700 }}>{money(summary.payout)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 7.5, color: MUTED }}>Nárok v Kč {money(summary.czkClaim)}</Text>
          <Text style={{ fontSize: 7.5, color: MUTED }}>
            Doplatek {money(summary.eurBalance, 'EUR')} × {rate(advance.rate)} = {money(summary.eurBalanceCzk)}
          </Text>
          <Text style={{ fontSize: 7.5, color: MUTED }}>Celkové náklady cesty {money(summary.totalCostCzk)}</Text>
        </View>
      </View>
      <View style={s.row} wrap={false}>
        <Card label="Stravné" value={money(summary.foreignPerDiemEur, 'EUR')} sub={`tuzemské ${money(summary.domesticPerDiem)}`} />
        <Card label="Výdaje zaměstnance" value={money(summary.paidByEmployeeCzk)} sub={`ze zálohy ${money(summary.paidFromAdvanceEur, 'EUR')}`} />
        <Card label="Soukromé vozidlo" value={money(summary.vehicleCzk)} sub={`${num(vehicle.km, 0)} km`} />
        <Card label="Záloha" value={money(summary.advanceEur, 'EUR')} sub={`doplatek ${money(summary.eurBalance, 'EUR')}`} last />
      </View>

      <Text style={s.h2}>Průběh cesty · {trip.actual.start} – {trip.actual.end}</Text>
      <Table
        cols={[{ h: '#', w: 4 }, { h: 'Odkud – kam', w: 24 }, { h: 'Odjezd', w: 12 }, { h: 'Příjezd', w: 12 }, { h: 'Doprava', w: 17 }, { h: 'km', w: 6, right: true }, { h: 'Přechod hranice', w: 25 }]}
        rows={segments.map((x) => [String(x.n), `${x.from} – ${x.to}`, x.dep, x.arr, x.transport, num(x.km, 0), x.border || '–'])}
      />

      <Text style={s.h2}>Stravné po dnech</Text>
      <Table
        cols={[{ h: 'Den', w: 14 }, { h: 'ČR', w: 9 }, { h: 'Zahraničí', w: 11 }, { h: 'Stát · sazba', w: 16 }, { h: 'Pásmo', w: 13 }, { h: 'Nárok', w: 8, right: true }, { h: 'Jídla', w: 7 }, { h: 'Krácení', w: 12, right: true }, { h: 'Stravné', w: 10, right: true }]}
        rows={perDiem.map((d) => [d.date, d.czTime, d.abroadTime, `AT · ${num(d.baseRate)} EUR`, d.band, num(d.base), meals(d.meals), d.reduction ? `${d.reductionLabel} = −${num(d.reduction)}` : '–', `${num(d.result)} EUR`])}
        foot={['Celkem', '', '', '', '', '', '', `−${num(summary.mealReductionEur)}`, `${num(summary.foreignPerDiemEur)} EUR`]}
      />
      <Text style={s.note}>
        S/O/V = bezplatně poskytnutá snídaně/oběd/večeře. Krácení z částky pásma, stravné za den zaokrouhleno na celé EUR nahoru. Doba v ČR je v obou dnech kratší než 5 h, tuzemské stravné nenáleží.
      </Text>

      <Text style={s.h2}>Výdaje</Text>
      <Table
        cols={[{ h: '#', w: 4 }, { h: 'Výdaj', w: 34 }, { h: 'Částka', w: 13, right: true }, { h: 'Kurz · zdroj', w: 18 }, { h: 'Kč', w: 12, right: true }, { h: 'Úhrada', w: 13 }, { h: 'Dokl.', w: 6, right: true }]}
        rows={expenses.map((e) => [
          String(e.n),
          `${e.category} – ${e.supplier}, ${e.date}${e.reimbursable ? '' : ' · neproplácí se'}`,
          money(e.amount, e.currency),
          e.currency === 'CZK' ? '–' : `${rate(e.rate)} · ${e.rateSource}`,
          num(e.czk),
          e.payment,
          `${e.docs.accounting.length}+${e.docs.payment.length}`,
        ])}
      />

      <View wrap={false}>
        <Text style={s.h2}>Soukromé vozidlo · {vehicle.label} · {vehicle.plate}</Text>
        <Table
          cols={[{ h: 'Složka náhrady', w: 40 }, { h: 'Výpočet', w: 40 }, { h: 'Kč', w: 20, right: true }]}
          rows={[
            ['Základní náhrada', `${num(vehicle.km, 0)} km × ${num(vehicle.ratePerKm)} Kč`, num(vehicle.basic)],
            [`Pohonné hmoty (${vehicle.consumption})`, `${num(vehicle.fuelLitres)} l × ${num(vehicle.fuelPrice)} Kč · ${vehicle.fuelPriceSource}`, num(vehicle.fuelComp)],
          ]}
          foot={['Celkem', '', num(vehicle.total)]}
        />
      </View>

      <View wrap={false}>
        <Text style={s.h2}>Vyrovnání zálohy</Text>
        <Table
          cols={[{ h: 'Položka', w: 60 }, { h: 'EUR', w: 20, right: true }, { h: 'Kč', w: 20, right: true }]}
          rows={[
            ['Zahraniční stravné', num(summary.foreignPerDiemEur), ''],
            ['Výdaje uhrazené ze zálohy', num(summary.paidFromAdvanceEur), ''],
            ['Výdaje uhrazené zaměstnancem', '', num(summary.paidByEmployeeCzk)],
            ['Náhrada za soukromé vozidlo', '', num(summary.vehicleCzk)],
            [`Poskytnutá záloha ${advance.providedOn}`, `−${num(summary.advanceEur)}`, ''],
            [`Doplatek v EUR × kurz zálohy ${rate(advance.rate)}`, num(summary.eurBalance), num(summary.eurBalanceCzk)],
          ]}
          foot={['K výplatě (zaokrouhleno na celé Kč)', '', money(summary.payout)]}
        />
      </View>

      <View wrap={false}>
        <Text style={s.h2}>Prohlášení a schválení</Text>
        <Text style={{ marginBottom: 3 }}>{declaration}</Text>
        <Text style={{ marginBottom: 6, color: MUTED }}>Připojeno dokladů: {summary.documentCount}</Text>
        <View style={s.row}>
          <SignBox title="Zaměstnanec" hint="Datum a podpis" />
          <SignBox title="Věcná kontrola" hint="Nadřízený – datum, podpis" />
          <SignBox title="Účetní kontrola" hint="Datum, podpis" />
          <SignBox title="Schváleno k výplatě" hint="Datum, podpis" last />
        </View>
      </View>
    </Page>

    {/* UKÁZKA STRÁNKY Z KOMPLETNÍ DOKUMENTACE */}
    <Page size="A4" style={s.page}>
      <Header part="Kompletní dokumentace · Doklady k výdajům" />
      <Footer />
      <Text style={s.kicker}>VÝDAJ 1 Z {expenses.length}</Text>
      <Text style={s.h1}>
        {expenses[0].category} · {money(expenses[0].amount, expenses[0].currency)}
      </Text>
      <View style={s.row}>
        <Card label="Částka v Kč" value={money(expenses[0].czk)} sub={`kurz ${rate(expenses[0].rate)} · ${expenses[0].rateSource}`} />
        <Card label="Úhrada" value={expenses[0].payment} sub={`uhradil: ${expenses[0].payer}`} />
        <Card label="Přílohy" value="2 dokumenty" sub="1 účetní doklad, 1 doklad o zaplacení" last />
      </View>
      <Text style={s.h2}>Údaje o výdaji</Text>
      <KV
        items={[
          ['Popis', expenses[0].description],
          ['Dodavatel', expenses[0].supplier],
          ['Datum', expenses[0].date],
        ]}
      />
      <Text style={s.h2}>Následují přílohy</Text>
      <Table
        cols={[{ h: '#', w: 6 }, { h: 'Typ', w: 30 }, { h: 'Dokument', w: 49 }, { h: 'Stran', w: 15, right: true }]}
        rows={[
          ['1', 'Účetní doklad', expenses[0].docs.accounting[0], '1'],
          ['2', 'Doklad o zaplacení', expenses[0].docs.payment[0], '1'],
        ]}
      />
    </Page>
  </Document>
);
