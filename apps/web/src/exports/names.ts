/** Název souboru bez diakritiky a znaků, které systémy v názvu nesnesou. */
export function slug(s: string, fallback = 'soubor'): string {
  const out = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return out.slice(0, 80) || fallback;
}
