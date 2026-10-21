import type { DocModel, DocPart, Layout } from '@cp/documents/model';

/** Vytvoří PDF v prohlížeči. Knihovna i písma (OFL) se načtou až při prvním použití. */
export async function generatePdf(model: DocModel, layout: Layout, part: DocPart): Promise<Blob> {
  const [docs, regular, bold, serifBold] = await Promise.all([
    import('@cp/documents'),
    import('@cp/documents/fonts/NotoSans-Regular.ttf?url'),
    import('@cp/documents/fonts/NotoSans-Bold.ttf?url'),
    import('@cp/documents/fonts/NotoSerif-Bold.ttf?url'),
  ]);
  docs.registerFonts({ regular: regular.default, bold: bold.default, serifBold: serifBold.default });
  return docs.renderPdf(model, layout, part);
}

export { fileName } from '@cp/documents/model';
