// Pravidla bezpečnosti, která hlídá test místo linteru: žádné vkládání HTML a žádné spouštění textu jako kódu.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../', import.meta.url).pathname;
const dirs = ['apps/web/src', 'apps/server/src', 'packages/core/src', 'packages/documents/src', 'packages/rules/src', 'functions'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

describe('bezpečnost zdrojového kódu', () => {
  const sources = dirs.flatMap((d) => files(join(root, d))).map((p) => ({ p: p.slice(root.length), text: readFileSync(p, 'utf8') }));

  it('kontroluje všechny zdrojové soubory', () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  it.each([
    ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
    ['innerHTML / outerHTML', /\.(inner|outer)HTML\s*=/],
    ['eval / new Function', /\beval\(|new Function\(/],
    ['document.write', /document\.write/],
    ['target=_blank bez rel', /target="_blank"(?![^>]*rel=)/],
  ])('nepoužívá %s', (_, re) => {
    expect(sources.filter((s) => re.test(s.text)).map((s) => s.p)).toEqual([]);
  });

  it('aplikace nevolá cizí servery – jen vlastní /api', () => {
    const external = sources.filter((s) => s.p.startsWith('apps/web/') && /fetch\(\s*['"`]https?:/.test(s.text));
    expect(external.map((s) => s.p)).toEqual([]);
  });
});
