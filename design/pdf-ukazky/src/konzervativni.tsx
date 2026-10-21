// Návrh 1 – konzervativní formulářový dokument.
// Rámečky a mřížka jako u tradičních tiskopisů, číslované oddíly, vše čitelné černobíle.
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { money, num, rate, sampleNotice } from './common.js';
import { trip, segments, perDiem, expenses, vehicle, summary, advance, ruleSet, declaration } from './data.js';

const B = '0.75pt solid #000';
const s = StyleSheet.create({
  page: { fontFamily: 'Noto Sans', fontSize: 8.5, paddingTop: 42, paddingBottom: 42, paddingHorizontal: 36, color: '#000' },
  header: { position: 'absolute', top: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5 },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, borderTop: '0.5pt solid #000', paddingTop: 3 },
  title: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 16, textAlign: 'center', marginBottom: 2 },
  subtitle: { textAlign: 'center', fontSize: 9, marginBottom: 10 },
  section: { border: B, marginBottom: 8 },
  sectionTitle: { backgroundColor: '#e6e6e6', borderBottom: B, paddingVertical: 2.5, paddingHorizontal: 5, fontWeight: 700, fontSize: 9 },
  row: { flexDirection: 'row' },
  cell: { borderRight: B, borderBottom: B, paddingVertical: 3, paddingHorizontal: 4 },
  label: { fontSize: 6.5, color: '#000', marginBottom: 1 },
  value: { fontSize: 9 },
  th: { fontWeight: 700, fontSize: 7, backgroundColor: '#f2f2f2' },
  td: { fontSize: 7.8 },
  right: { textAlign: 'right' },
  sign: { height: 68, justifyContent: 'flex-end', paddingHorizontal: 5, paddingBottom: 3 },
  signLabel: { borderTop: '0.5pt dotted #000', paddingTop: 2, fontSize: 7 },
  note: { fontSize: 7, fontStyle: 'italic', paddingHorizontal: 5, paddingVertical: 3 },
});

const Header = () => (
  <View style={s.header} fixed>
    <Text>{trip.employer.name}</Text>
    <Text style={{ fontWeight: 700 }}>Cestovní příkaz č. {trip.number}</Text>
  </View>
);
const Footer = () => (
  <View style={s.footer} fixed>
    <Text>{trip.number} · Sazby: {ruleSet.id} v{ruleSet.version}</Text>
    <Text>{sampleNotice}</Text>
    <Text render={({ pageNumber, totalPages }) => `Strana ${pageNumber} z ${totalPages}`} />
  </View>
);

/** Mřížka polí: každé pole má popisek a hodnotu, šířky v procentech v rámci řádku. */
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
  const line = (cells: string[], style: object, key: React.Key, last: boolean) => (
    <View key={key} style={s.row} wrap={false}>
      {cells.map((c, j) => (
        <Text key={j} style={[s.cell, style, { width: `${cols[j].w}%` }, cols[j].right ? s.right : {}, j === cells.length - 1 ? { borderRight: 0 } : {}, last ? { borderBottom: 0 } : {}]}>
          {c}
        </Text>
      ))}
    </View>
  );
  return (
    <View>
      {line(cols.map((c) => c.h), s.th, 'h', false)}
      {rows.map((r, i) => line(r, s.td, i, !foot && i === rows.length - 1))}
      {foot && line(foot, [s.td, { fontWeight: 700 }], 'f', true)}
    </View>
  );
};

const Section = ({ n, title, children, wrap = true }: { n: string; title: string; children: React.ReactNode; wrap?: boolean }) => (
  <View style={s.section} wrap={wrap}>
    <Text style={s.sectionTitle}>
      {n}. {title}
    </Text>
    {children}
  </View>
);

const Signatures = ({ items }: { items: string[] }) => (
  <View style={s.row}>
    {items.map((t, i) => (
      <View key={i} style={[s.sign, { width: `${100 / items.length}%` }, i < items.length - 1 ? { borderRight: B } : {}]}>
        <Text style={s.signLabel}>{t}</Text>
      </View>
    ))}
  </View>
);

const meals = (m: { b: boolean; l: boolean; d: boolean }) => [m.b && 'snídaně', m.l && 'oběd', m.d && 'večeře'].filter(Boolean).join(', ') || '–';

export const Konzervativni = () => (
  <Document title={`${trip.number} Cestovní příkaz a žádost o vyplacení`} author={trip.employee.name} language="cs">
    {/* ČÁST A – CESTOVNÍ PŘÍKAZ */}
    <Page size="A4" style={s.page}>
      <Header />
      <Footer />
      <Text style={s.title}>CESTOVNÍ PŘÍKAZ</Text>
      <Text style={s.subtitle}>
        č. {trip.number} · Část A – příkaz k pracovní cestě · {trip.kind} pracovní cesta
      </Text>

      <Section n="1" title="Zaměstnavatel">
        <Fields
          rows={[
            [['Název', trip.employer.name, 50], ['IČO', trip.employer.ico, 20], ['Režim náhrad', trip.sector, 30]],
            [['Sídlo', trip.employer.seat, 50], ['Nákladové středisko', trip.employer.costCenter, 20], ['Projekt / zakázka', trip.employer.project, 30]],
          ]}
        />
      </Section>

      <Section n="2" title="Zaměstnanec">
        <Fields
          rows={[
            [['Jméno a příjmení', trip.employee.name, 50], ['Osobní číslo', trip.employee.personalNumber, 20], ['Útvar', trip.employee.department, 30]],
            [['Pracovní pozice', trip.employee.position, 50], ['Pravidelné pracoviště', trip.employee.regularWorkplace, 50]],
          ]}
        />
      </Section>

      <Section n="3" title="Pracovní cesta">
        <Fields
          rows={[
            [['Účel cesty', trip.purpose, 100]],
            [['Místo nástupu', trip.plan.startPlace, 25], ['Začátek (datum, hodina)', trip.plan.start, 25], ['Místo ukončení', trip.plan.endPlace, 25], ['Konec (datum, hodina)', trip.plan.end, 25]],
            [['Cílová místa', trip.plan.destinations, 50], ['Průjezdní místa', trip.plan.via, 50]],
            [['Dopravní prostředek', trip.plan.transport, 50], ['Záloha', money(advance.amount, advance.currency), 20], ['Záloha vyplacena dne', advance.providedOn, 30]],
          ]}
        />
      </Section>

      <Section n="4" title="Vystavení a schválení příkazu" wrap={false}>
        <Fields rows={[[['Místo vystavení', trip.issuedPlace, 50], ['Datum vystavení', trip.issuedDate, 50]]]} />
        <View style={{ borderTop: B }}>
          <Signatures items={['Podpis zaměstnance (souhlas s cestou)', 'Schválil – podpis zaměstnavatele / nadřízeného']} />
        </View>
      </Section>
    </Page>

    {/* ČÁST B – VYÚČTOVÁNÍ */}
    <Page size="A4" style={s.page}>
      <Header />
      <Footer />
      <Text style={s.title}>VYÚČTOVÁNÍ PRACOVNÍ CESTY</Text>
      <Text style={s.subtitle}>č. {trip.number} · Část B – vyúčtování a žádost o vyplacení náhrad</Text>

      <Section n="5" title="Skutečný průběh cesty">
        <Fields rows={[[['Skutečný začátek', trip.actual.start, 25], ['Skutečný konec', trip.actual.end, 25], ['Celkem km', num(vehicle.km, 0), 15], ['Dopravní prostředek', trip.plan.transport, 35]]]} />
        <View style={{ borderTop: B }}>
          <Table
            cols={[{ h: '#', w: 4 }, { h: 'Odkud', w: 14 }, { h: 'Kam', w: 14 }, { h: 'Odjezd', w: 12 }, { h: 'Příjezd', w: 12 }, { h: 'Doprava', w: 15 }, { h: 'km', w: 6, right: true }, { h: 'Přechod hranice', w: 23 }]}
            rows={segments.map((x) => [String(x.n), x.from, x.to, x.dep, x.arr, x.transport, num(x.km, 0), x.border || '–'])}
          />
        </View>
      </Section>

      <Section n="6" title="Stravné">
        <Table
          cols={[{ h: 'Den', w: 13 }, { h: 'Doba v ČR / tuzemské', w: 13 }, { h: 'Doba v zahraničí', w: 11 }, { h: 'Stát, základní sazba', w: 14 }, { h: 'Pásmo', w: 11 }, { h: 'Nárok', w: 8, right: true }, { h: 'Bezplatná jídla', w: 12 }, { h: 'Krácení', w: 10, right: true }, { h: 'Stravné', w: 8, right: true }]}
          rows={perDiem.map((d) => [d.date, `${d.czTime} / ${money(d.domestic)}`, d.abroadTime, `${d.country}, ${num(d.baseRate)} EUR`, d.band, num(d.base), meals(d.meals), d.reduction ? `${d.reductionLabel} = ${num(d.reduction)}` : '–', `${num(d.result)} EUR`])}
          foot={['Celkem', money(0), '', '', '', '', '', num(summary.mealReductionEur), `${num(summary.foreignPerDiemEur)} EUR`]}
        />
        <Text style={[s.note, { borderTop: B }]}>
          Krácení se počítá ze základní sazby. Stravné za den je zaokrouhleno na celé EUR nahoru (před zaokrouhlením: {perDiem.map((d) => num(d.beforeRounding)).join(' / ')} EUR). Doba v ČR v jednotlivých dnech je kratší než 5 hodin, tuzemské stravné nenáleží.
        </Text>
      </Section>

      <Section n="7" title="Výdaje">
        <Table
          cols={[{ h: '#', w: 4 }, { h: 'Datum', w: 10 }, { h: 'Kategorie, popis, dodavatel', w: 27 }, { h: 'Částka', w: 11, right: true }, { h: 'Kurz, zdroj', w: 13 }, { h: 'Kč', w: 11, right: true }, { h: 'Úhrada', w: 14 }, { h: 'Dokl.', w: 10, right: true }]}
          rows={expenses.map((e) => [
            String(e.n),
            e.date,
            `${e.category}: ${e.description}; ${e.supplier}${e.reimbursable ? '' : ' (neproplácí se)'}`,
            money(e.amount, e.currency),
            e.currency === 'CZK' ? '–' : `${rate(e.rate)}; ${e.rateSource}`,
            num(e.czk),
            e.payment,
            `${e.docs.accounting.length} + ${e.docs.payment.length}`,
          ])}
        />
        <Text style={[s.note, { borderTop: B }]}>Dokl. = počet účetních dokladů + počet dokladů o zaplacení. Výdaj č. 5 slouží jako doklad o ceně pohonných hmot a není zahrnut do součtu výdajů.</Text>
      </Section>

      <Section n="8" title="Náhrada za použití soukromého vozidla" wrap={false}>
        <Fields
          rows={[
            [['Vozidlo, RZ', `${vehicle.label}, ${vehicle.plate}`, 30], ['Vlastník', vehicle.owner, 25], ['Palivo', vehicle.fuel, 20], ['Spotřeba', vehicle.consumption, 25]],
            [['Ujeto km', num(vehicle.km, 0), 15], ['Základní náhrada', `${num(vehicle.km, 0)} × ${num(vehicle.ratePerKm)} Kč = ${money(vehicle.basic)}`, 35], ['Náhrada za PHM', `${num(vehicle.fuelLitres)} l × ${num(vehicle.fuelPrice)} Kč = ${money(vehicle.fuelComp)}`, 30], ['Celkem', money(vehicle.total), 20]],
            [['Cena PHM', vehicle.fuelPriceSource, 50], ['Použito na žádost zaměstnavatele', vehicle.requestedByEmployer ? 'Ano' : 'Ne', 50]],
          ]}
        />
      </Section>

      <Section n="9" title="Souhrn vyúčtování" wrap={false}>
        <Table
          cols={[{ h: 'Položka', w: 60 }, { h: 'EUR', w: 20, right: true }, { h: 'Kč', w: 20, right: true }]}
          rows={[
            ['Tuzemské stravné', '', num(summary.domesticPerDiem)],
            ['Zahraniční stravné (po krácení o ' + num(summary.mealReductionEur) + ' EUR)', num(summary.foreignPerDiemEur), ''],
            ['Výdaje uhrazené ze zálohy', num(summary.paidFromAdvanceEur), ''],
            ['Výdaje uhrazené zaměstnancem', '', num(summary.paidByEmployeeCzk)],
            ['Náhrada za soukromé vozidlo', '', num(summary.vehicleCzk)],
            ['Nárok celkem', num(summary.eurClaim), num(summary.czkClaim)],
            [`Poskytnutá záloha (${advance.providedOn})`, '−' + num(summary.advanceEur), ''],
            [`Doplatek v EUR přepočtený kurzem zálohy ${rate(advance.rate)}`, num(summary.eurBalance), num(summary.eurBalanceCzk)],
          ]}
          foot={['K VÝPLATĚ ZAMĚSTNANCI (zaokrouhleno na celé Kč)', '', money(summary.payout)]}
        />
      </Section>

      <Section n="10" title="Prohlášení zaměstnance a schválení" wrap={false}>
        <Text style={{ padding: 5, fontSize: 8 }}>{declaration}</Text>
        <Text style={{ paddingHorizontal: 5, paddingBottom: 4, fontSize: 8 }}>Počet připojených dokladů: {summary.documentCount}</Text>
        <View style={{ borderTop: B }}>
          <Signatures items={['Datum a podpis zaměstnance', 'Věcná kontrola – podpis nadřízeného', 'Účetní kontrola – podpis', 'Schváleno k výplatě – datum, podpis']} />
        </View>
      </Section>
    </Page>

    {/* UKÁZKA STRÁNKY Z KOMPLETNÍ DOKUMENTACE */}
    <Page size="A4" style={s.page}>
      <Header />
      <Footer />
      <Text style={s.title}>VÝDAJ Č. 1</Text>
      <Text style={s.subtitle}>Identifikační stránka – v kompletní dokumentaci předchází dokladům k výdaji</Text>
      <Section n="1" title="Údaje o výdaji">
        <Fields
          rows={[
            [['Kategorie', expenses[0].category, 30], ['Popis', expenses[0].description, 70]],
            [['Dodavatel', expenses[0].supplier, 50], ['Datum', expenses[0].date, 50]],
            [['Částka', money(expenses[0].amount, expenses[0].currency), 25], ['Kurz', rate(expenses[0].rate), 25], ['Zdroj kurzu', expenses[0].rateSource, 25], ['Částka v Kč', money(expenses[0].czk), 25]],
            [['Způsob úhrady', expenses[0].payment, 50], ['Uhradil', expenses[0].payer, 50]],
          ]}
        />
      </Section>
      <Section n="2" title="Následující přílohy">
        <Table
          cols={[{ h: '#', w: 6 }, { h: 'Typ', w: 30 }, { h: 'Dokument', w: 44 }, { h: 'Stran', w: 20, right: true }]}
          rows={[
            ['1', 'Účetní doklad', expenses[0].docs.accounting[0], '1'],
            ['2', 'Doklad o zaplacení', expenses[0].docs.payment[0], '1'],
          ]}
        />
      </Section>
    </Page>
  </Document>
);
