import { Font } from '@react-pdf/renderer';

export interface FontSources {
  regular: string;
  bold: string;
  serifBold: string;
}

let registered = false;

function register(src: FontSources) {
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
}

/** Zaregistruje písma Noto (licence OFL). Zdroj je URL v prohlížeči, nebo cesta k souboru v Node. */
export function registerFonts(src: FontSources) {
  if (registered) return;
  registered = true;
  register(src);
}

/**
 * Zahodí načtená data našich písem, aby se při dalším PDF načetla znovu. @react-pdf sdílí načtené písmo
 * mezi dokumenty vytvořenými v jedné relaci a v dalších dokumentech pak mohou chybět znaky.
 * (Font.reset() v @react-pdf/font 4.1 nevynuluje příznak načtení a Font.clear() smaže i vestavěná písma.)
 */
export function resetFonts() {
  const families = Font.getRegisteredFonts() as Record<string, { sources: { data: unknown; loadResultPromise: unknown }[] }>;
  for (const name of ['Noto Sans', 'Noto Serif']) {
    for (const source of families[name]?.sources ?? []) {
      source.data = null;
      source.loadResultPromise = null;
    }
  }
}
