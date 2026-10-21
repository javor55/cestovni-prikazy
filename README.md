# Cestovní příkazy

Webová aplikace pro přípravu cestovního příkazu, výpočet cestovních náhrad podle českého zákoníku práce a sestavení kompletní dokumentace (PDF, XLSX, CSV, JSON) k odevzdání účetní.

Hotové je výpočetní jádro (`packages/core`) se sazbami pro rok 2026 (`packages/rules`), webová aplikace s průvodcem vyplněním cesty, přílohami dokladů a PDF cestovního příkazu a vyúčtování k podpisu (`apps/web`, šablony v `packages/documents`) a server s kurzy ČNB (`apps/server`). Data i doklady se ukládají jen v prohlížeči, PDF se vytváří také v prohlížeči. Hotové je i nahrání podepsaného skenu nebo vložení obrázku podpisu a kompletní PDF se všemi doklady. Exporty a import projektu přibudou v dalším milníku. Dokumentace je v adresáři [`docs/`](docs/).

```
pnpm install
pnpm --filter @cp/server dev   # server s kurzy ČNB na http://localhost:8787
pnpm --filter @cp/web dev      # aplikace na http://localhost:5173 (/api přesměruje na server)
pnpm check                     # kontrola typů + jednotkové testy
pnpm e2e                       # testy v prohlížeči (mobil 320 px, mobil, desktop)
```


| Dokument | Obsah |
|---|---|
| [01 – Analýza](docs/01-analyza.md) | Zadání, rozhodnutí, rizika, návrh MVP a architektury |
| [02 – Otázky pro účetní](docs/02-otazky-pro-ucetni.md) | Legislativní body k potvrzení |
| [03 – Návrh dokumentů](docs/03-navrh-dokumentu.md) | Dva návrhy PDF s ukázkami |
| [04 – UX návrh](docs/04-ux-navrh.md) | Klikací prototyp obrazovek |
| [05 – Technický návrh](docs/05-technicky-navrh.md) | Architektura, výpočetní jádro, PDF, bezpečnost, nasazení |
| [06 – Aktualizace sazeb](docs/06-aktualizace-sazeb.md) | Nový rok, změna cen paliv, zahraniční stravné, měny a státy, kurzy ČNB |
