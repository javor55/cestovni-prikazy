import { Font } from '@react-pdf/renderer';

export interface FontSources {
  regular: string;
  bold: string;
  serifBold: string;
}

let registered = false;

/** Zaregistruje písma Noto (licence OFL). Zdroj je URL v prohlížeči, nebo cesta k souboru v Node. */
export function registerFonts(src: FontSources) {
  if (registered) return;
  Font.register({
    family: 'Noto Sans',
    fonts: [
      { src: src.regular },
      { src: src.bold, fontWeight: 700 },
    ],
  });
  Font.register({ family: 'Noto Serif', fonts: [{ src: src.serifBold, fontWeight: 700 }] });
  // Bez dělení slov – u jmen, míst a čísel by bylo matoucí.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
