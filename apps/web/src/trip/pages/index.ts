import type { ComponentType } from 'react';
import type { StepSlug } from '../steps.js';
import { StepCesta } from './StepCesta.js';
import { StepJidla } from './StepJidla.js';
import { StepKdo } from './StepKdo.js';
import { StepKontrola } from './StepKontrola.js';
import { StepPdf } from './StepPdf.js';
import { StepPrubeh } from './StepPrubeh.js';
import { StepSouhrn } from './StepSouhrn.js';
import { StepVozidlo } from './StepVozidlo.js';
import { StepVydaje } from './StepVydaje.js';

export const StepPages: Record<StepSlug, ComponentType> = {
  kdo: StepKdo,
  cesta: StepCesta,
  prubeh: StepPrubeh,
  jidla: StepJidla,
  vydaje: StepVydaje,
  vozidlo: StepVozidlo,
  souhrn: StepSouhrn,
  kontrola: StepKontrola,
  pdf: StepPdf,
};
