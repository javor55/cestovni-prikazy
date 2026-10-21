// Přesná racionální čísla nad BigInt. Výpočty probíhají bez zaokrouhlení
// a zaokrouhluje se až v místech, která určuje sada pravidel.

export type RoundMode = 'HALF_UP' | 'CEIL' | 'FLOOR';

export class Fraction {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error('Dělení nulou');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static of(value: bigint | number): Fraction {
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) throw new Error(`Očekáváno celé číslo: ${value}`);
      return new Fraction(BigInt(value));
    }
    return new Fraction(value);
  }

  /** Desetinné číslo zapsané jako text („24.422“, „5,6“) převede přesně, bez chyb plovoucí čárky. */
  static parse(text: string | number): Fraction {
    const s = String(text).trim().replace(',', '.');
    const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
    if (!m) throw new Error(`Neplatné číslo: ${text}`);
    const frac = m[3] ?? '';
    const n = BigInt(m[2]! + frac) * (m[1] ? -1n : 1n);
    return new Fraction(n, 10n ** BigInt(frac.length));
  }

  add(o: Fraction): Fraction {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Fraction): Fraction {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Fraction | bigint | number): Fraction {
    const f = o instanceof Fraction ? o : Fraction.of(o);
    return new Fraction(this.n * f.n, this.d * f.d);
  }
  div(o: Fraction | bigint | number): Fraction {
    const f = o instanceof Fraction ? o : Fraction.of(o);
    return new Fraction(this.n * f.d, this.d * f.n);
  }
  max(o: Fraction): Fraction {
    return this.cmp(o) >= 0 ? this : o;
  }
  cmp(o: Fraction): number {
    const a = this.n * o.d;
    const b = o.n * this.d;
    return a === b ? 0 : a < b ? -1 : 1;
  }
  isZero(): boolean {
    return this.n === 0n;
  }

  /** Zaokrouhlí na celé číslo. HALF_UP zaokrouhluje polovinu od nuly. */
  round(mode: RoundMode = 'HALF_UP'): bigint {
    const { n, d } = this;
    const q = n / d; // BigInt dělení ořezává k nule
    const r = n % d;
    if (r === 0n) return q;
    const neg = n < 0n;
    switch (mode) {
      case 'FLOOR':
        return neg ? q - 1n : q;
      case 'CEIL':
        return neg ? q : q + 1n;
      case 'HALF_UP': {
        const twice = (neg ? -r : r) * 2n;
        return twice >= d ? (neg ? q - 1n : q + 1n) : q;
      }
    }
  }

  /** Celé číslo jako Number – pro částky v haléřích/centech, které se do Number vejdou bezpečně. */
  toInt(mode: RoundMode = 'HALF_UP'): number {
    return Number(this.round(mode));
  }

  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

export const ZERO = new Fraction(0n);
