# Cestovní příkazy

Webová aplikace pro přípravu cestovního příkazu, výpočet cestovních náhrad podle českého zákoníku práce a sestavení kompletní dokumentace (PDF, XLSX, CSV, JSON) k odevzdání účetní.

Hotové je výpočetní jádro (`packages/core`) se sazbami pro rok 2026 (`packages/rules`), webová aplikace s průvodcem vyplněním cesty, přílohami dokladů a PDF cestovního příkazu a vyúčtování k podpisu (`apps/web`, šablony v `packages/documents`) a server s kurzy ČNB (`apps/server`). Data i doklady se ukládají jen v prohlížeči, PDF se vytváří také v prohlížeči. Hotové je i nahrání podepsaného skenu nebo vložení obrázku podpisu, kompletní PDF se všemi doklady, exporty XLSX, CSV a JSON, ZIP s originály dokladů a export a import pracovního projektu (ZIP). Aplikaci jde nainstalovat do telefonu a po první návštěvě funguje i bez připojení. Nasazuje se na Cloudflare Pages nebo jako obraz Docker. Dokumentace je v adresáři [`docs/`](docs/).

```
pnpm install
pnpm --filter @cp/server dev   # server s kurzy ČNB na http://localhost:8787
pnpm --filter @cp/web dev      # aplikace na http://localhost:5173 (/api přesměruje na server)
pnpm check                     # kontrola typů + jednotkové testy
pnpm e2e                       # testy v prohlížeči (mobil 320 px, mobil, desktop)
docker compose up -d --build   # provoz s HTTPS (nastavení v .env, viz docs/07)
```

Nasazení na Cloudflare Pages, na vlastní server a do firemní sítě popisuje [07 – Nasazení a provoz](docs/07-nasazeni.md).


| Dokument | Obsah |
|---|---|
| [01 – Analýza](docs/01-analyza.md) | Zadání, rozhodnutí, rizika, návrh MVP a architektury |
| [02 – Otázky pro účetní](docs/02-otazky-pro-ucetni.md) | Legislativní body k potvrzení |
| [03 – Návrh dokumentů](docs/03-navrh-dokumentu.md) | Dva návrhy PDF s ukázkami |
| [04 – UX návrh](docs/04-ux-navrh.md) | Klikací prototyp obrazovek |
| [05 – Technický návrh](docs/05-technicky-navrh.md) | Architektura, výpočetní jádro, PDF, bezpečnost, nasazení |
| [06 – Aktualizace sazeb](docs/06-aktualizace-sazeb.md) | Nový rok, změna cen paliv, zahraniční stravné, měny a státy, kurzy ČNB |
| [07 – Nasazení a provoz](docs/07-nasazeni.md) | Cloudflare Pages, Docker s HTTPS, firemní síť, proměnné prostředí, bezpečnost |
