import { expect, test as base } from '@playwright/test';

/**
 * Všechny E2E testy běží v náhledu se stejnou CSP jako v provozu. Každé porušení CSP
 * (zablokovaný skript, styl, písmo, worker…) test shodí, i kdyby se navenek nic nerozbilo.
 */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on('console', (m) => {
        if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
      });
      await use(violations);
      expect(violations, 'porušení CSP').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
