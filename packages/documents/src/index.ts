import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { ConservativeDocument } from './Conservative.js';
import { ModernDocument } from './Modern.js';
import type { DocModel, DocPart, Layout } from './model.js';

export * from './model.js';
export { registerFonts, type FontSources } from './fonts.js';
export { ConservativeDocument, ModernDocument };

export function documentElement(model: DocModel, layout: Layout, part: DocPart) {
  return createElement(layout === 'modern' ? ModernDocument : ConservativeDocument, { m: model, part });
}

/** Vytvoří PDF jako Blob (v prohlížeči). Písma musí být předem zaregistrována přes registerFonts(). */
export async function renderPdf(model: DocModel, layout: Layout, part: DocPart): Promise<Blob> {
  // pdf() je typované pro <Document>; náš prvek Document vrací, jen přes vlastní komponentu.
  return pdf(documentElement(model, layout, part) as Parameters<typeof pdf>[0]).toBlob();
}
