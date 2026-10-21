# Cestovní příkazy

Webová aplikace pro přípravu cestovního příkazu, výpočet cestovních náhrad podle českého zákoníku práce a sestavení kompletní dokumentace (PDF, XLSX, CSV, JSON) k odevzdání účetní.

Hotové je výpočetní jádro (`packages/core`) se sazbami pro rok 2026 (`packages/rules`) a webová aplikace s průvodcem vyplněním cesty (`apps/web`). Data se ukládají jen v prohlížeči. PDF, přílohy, kurzy ČNB a exporty přibudou v dalších milnících. Dokumentace je v adresáři [`docs/`](docs/).

```
pnpm install
pnpm --filter @cp/web dev   # vývojový server na http://localhost:5173
pnpm check                  # kontrola typů + jednotkové testy
pnpm e2e                    # testy v prohlížeči (mobil 320 px, mobil, desktop)
```


| Dokument | Obsah |
|---|---|
| [01 – Analýza](docs/01-analyza.md) | Zadání, rozhodnutí, rizika, návrh MVP a architektury |
| [02 – Otázky pro účetní](docs/02-otazky-pro-ucetni.md) | Legislativní body k potvrzení |
| [03 – Návrh dokumentů](docs/03-navrh-dokumentu.md) | Dva návrhy PDF s ukázkami |
| [04 – UX návrh](docs/04-ux-navrh.md) | Klikací prototyp obrazovek |
| [05 – Technický návrh](docs/05-technicky-navrh.md) | Architektura, výpočetní jádro, PDF, bezpečnost, nasazení |
