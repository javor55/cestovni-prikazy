import React from 'react';
import { renderToFile } from '@react-pdf/renderer';
import { mkdir } from 'node:fs/promises';
import './common.js';
import { Konzervativni } from './konzervativni.js';
import { Moderni } from './moderni.js';
import { trip } from './data.js';

const out = new URL('../out/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
for (const [name, Doc] of [['konzervativni', Konzervativni], ['moderni', Moderni]] as const) {
  const file = `${out}${trip.number}_Cestovni-prikaz-a-zadost-o-vyplaceni_${name}.pdf`;
  await renderToFile(<Doc />, file);
  console.log(file);
}
