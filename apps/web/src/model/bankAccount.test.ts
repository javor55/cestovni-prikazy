import { describe, expect, it } from 'vitest';
import { bankAccountProblem } from './bankAccount.js';

describe('číslo účtu', () => {
  it('český účet s kontrolou modulo 11 a IBAN', () => {
    expect(bankAccountProblem('')).toBeUndefined();
    expect(bankAccountProblem('2000145399/0800')).toBeUndefined();
    expect(bankAccountProblem('19-2000145399/0800')).toBeUndefined();
    expect(bankAccountProblem('CZ65 0800 0000 1920 0014 5399')).toBeUndefined();
    expect(bankAccountProblem('DE89 3704 0044 0532 0130 00')).toBeUndefined();
    expect(bankAccountProblem('123456789/0800')).toMatch(/kontrolním součtem/);
    expect(bankAccountProblem('123456789')).toMatch(/ve tvaru/);
    expect(bankAccountProblem('CZ65 0800 0000 1920 0014 5398')).toMatch(/IBAN/);
  });
});
