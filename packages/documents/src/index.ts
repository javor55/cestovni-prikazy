import { pdf } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import { ConservativeDocument } from './Conservative.js';
import { ModernDocument } from './Modern.js';
import type { DocModel, DocPart, Layout } from './model.js';

export * from './model.js';
export { registerFonts, resetFonts, type FontSources } from './fonts.js';
import { resetFonts } from './fonts.js';
export { ConservativeDocument, ModernDocument };
export { assemble, type AssemblyFile, type AssemblyInput, type AssemblyStats, type FileKind } from './assemble.js';

export function documentElement(model: DocModel, layout: Layout, part: DocPart) {
  return createElement(layout === 'modern' ? ModernDocument : ConservativeDocument, { m: model, part });
}

/** Vyrenderuje libovolný prvek @react-pdf (dokument) na Blob – v prohlížeči. */
export function renderPdfElement(el: ReactElement): Promise<Blob> {
  resetFonts();
  return pdf(el as Parameters<typeof pdf>[0]).toBlob();
}

/** Vytvoří PDF jako Blob (v prohlížeči). Písma musí být předem zaregistrována přes registerFonts(). */
export async function renderPdf(model: DocModel, layout: Layout, part: DocPart): Promise<Blob> {
  resetFonts();
  // pdf() je typované pro <Document>; náš prvek Document vrací, jen přes vlastní komponentu.
  return pdf(documentElement(model, layout, part) as Parameters<typeof pdf>[0]).toBlob();
}
