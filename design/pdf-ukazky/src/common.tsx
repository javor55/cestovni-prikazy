import { Font } from '@react-pdf/renderer';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => require.resolve(`@expo-google-fonts/${pkg}/${file}`);

Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: font('noto-sans', '400Regular/NotoSans_400Regular.ttf') },
    { src: font('noto-sans', '400Regular_Italic/NotoSans_400Regular_Italic.ttf'), fontStyle: 'italic' },
    { src: font('noto-sans', '600SemiBold/NotoSans_600SemiBold.ttf'), fontWeight: 600 },
    { src: font('noto-sans', '700Bold/NotoSans_700Bold.ttf'), fontWeight: 700 },
  ],
});
Font.register({
  family: 'Noto Serif',
  fonts: [
    { src: font('noto-serif', '400Regular/NotoSerif_400Regular.ttf') },
    { src: font('noto-serif', '700Bold/NotoSerif_700Bold.ttf'), fontWeight: 700 },
  ],
});
// Žádné dělení slov – u jmen, čísel a míst by bylo matoucí.
Font.registerHyphenationCallback((word) => [word]);

const nf = (digits: number) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const money = (n: number, currency = 'Kč') => `${nf(2).format(n)} ${currency}`;
export const num = (n: number, digits = 2) => nf(digits).format(n);
export const rate = (n: number) => (n === 1 ? '–' : nf(4).format(n).replace(/0{1,2}$/, ''));

export const sampleNotice = 'UKÁZKA – fiktivní údaje, ilustrativní sazby a kurzy';
