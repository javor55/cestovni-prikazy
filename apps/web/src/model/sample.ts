// Ukázková cesta do Vídně pro testy (záloha v EUR, platba podle potvrzení banky, soukromé auto).

import { emptyExpense, emptySegment, newTrip, type TripDoc } from './trip.js';

export function vienna(): TripDoc {
  const t = newTrip(new Date('2026-10-12T08:00:00Z'));
  Object.assign(t, { kind: 'foreign', number: 'CP-2026-0042', purpose: 'Jednání', issuedPlace: 'Praha', issuedOn: '2026-10-12' });
  const out = { ...emptySegment(), fromPlace: 'Praha', toPlace: 'Vídeň', toCountry: 'AT', departure: '2026-10-14T06:30', arrival: '2026-10-14T11:00', crossingAt: '2026-10-14T09:45', transport: 'soukrome-auto' as const, km: '343' };
  const back = { ...emptySegment(out), toPlace: 'Praha', toCountry: 'CZ', departure: '2026-10-16T14:00', arrival: '2026-10-16T18:30', crossingAt: '2026-10-16T15:15', km: '343' };
  t.segments = [out, back];
  t.meals = { '2026-10-15': { breakfast: true, lunch: true, dinner: false }, '2026-10-16': { breakfast: true, lunch: false, dinner: false } };
  t.advances = [{ id: 'a', amount: '100', currency: 'EUR', providedOn: '2026-10-12', rate: '24,35', rateUnit: '1', rateDate: '2026-10-12' }];
  t.expenses = [
    { ...emptyExpense('2026-10-16'), id: 'h', category: 'Ubytování', supplier: 'Hotel', amount: '238', currency: 'EUR', rateSource: 'BANK_CONFIRMATION', czkAmount: '5 812,44' },
    { ...emptyExpense('2026-10-16'), id: 'p', category: 'Parkovné', amount: '36', currency: 'EUR', paymentMethod: 'ADVANCE' },
    { ...emptyExpense('2026-10-13'), id: 'z', category: 'Dálniční známka', amount: '12,80', currency: 'EUR', rate: '24,315', rateDate: '2026-10-12' },
    { ...emptyExpense('2026-10-15'), id: 'm', category: 'MHD', amount: '8', currency: 'EUR', paymentMethod: 'ADVANCE' },
    { ...emptyExpense('2026-10-16'), id: 'f', category: 'Pohonné hmoty', amount: '1 758,28', reimbursable: false },
  ];
  t.vehicle = { ...t.vehicle, used: true, model: 'Škoda Octavia', plate: '1AB 2345', consumption: ['5,6'], km: '686', receiptPrice: '38,90', receiptDate: '2026-10-16' };
  return t;
}
