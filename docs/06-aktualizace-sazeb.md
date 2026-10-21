# Aktualizace sazeb, států a měn

Sazby cestovních náhrad jsou v souboru sady pravidel, např. [`packages/rules/data/cz-2026.json`](../packages/rules/data/cz-2026.json). Ve výpočtu ani v obrazovkách nejsou žádné částky napevno. Částky se zapisují v nejmenších jednotkách měny: 155 Kč = `15500`, 45 EUR = `4500`, 6 500 JPY = `6500` (jen nemá haléře).

## Nový rok

1. Zkopírujte `cz-2026.json` na `cz-2027.json` a změňte `id`, `validFrom`, `validTo` a `version`.
2. Podle nové vyhlášky MPSV upravte tuzemské stravné (`domestic.bands`), sazby za km (`vehicle.ratesPerKm`) a průměrné ceny paliv (`vehicle.averagePrices`). Do `sources` doplňte čísla vyhlášek.
3. Zahraniční stravné převezměte z přílohy vyhlášky MF nástrojem níže.
4. Soubor zaregistrujte v [`packages/rules/src/index.ts`](../packages/rules/src/index.ts) (seznam `ruleSets`).
5. Do `packages/rules/test/` přidejte test s kontrolními hodnotami (jako u roku 2026) a spusťte `pnpm check`.
6. Výsledek nechte zkontrolovat účetní.

Stará sada pravidel zůstává, aby se výpočty dřívějších cest nezměnily.

## Změna ceny paliva během roku

MPSV při změně ceny o 20 % a více vydá novelu (v roce 2026 se tak změnila nafta od 1. 6. a benzin 95 od 1. 10.). Do `vehicle.averagePrices` se přidá nový řádek s `validFrom`, u předchozího se zkrátí `validTo` a do `sources` se doplní číslo novely. Test v `rules.test.ts` hlídá, že období na sebe navazují bez mezer.

## Zahraniční stravné z přílohy vyhlášky MF

1. Otevřete PDF vyhlášky na webu MF a zkopírujte text přílohy (řádky „Stát Měna Sazba“) do textového souboru, např. `priloha.txt`.
2. Spusťte:

   ```
   pnpm --filter @cp/rules exec tsx scripts/foreign-import.ts ../../priloha.txt data/cz-2027.json
   ```

3. Nástroj převede české názvy států na kódy ISO. Pokud název nezná (vyhláška občas používá jiný název než běžný), skončí s výpisem neznámých názvů. Doplňte je do `ALIASES` v [`scripts/foreign-import.ts`](../packages/rules/scripts/foreign-import.ts) a spusťte znovu.
4. Zkontrolujte rozdíl v gitu: počet států, měny a několik namátkových sazeb proti PDF.

> **Stav pro rok 2026:** úplná příloha vyhlášky č. 489/2025 Sb. zatím v aplikaci není. Oficiální text nebyl z vývojového prostředí dostupný. Aplikace obsahuje 8 nejčastějších států. U ostatních si uživatel sazbu zadá ručně v kroku Souhrn a aplikace na to upozorní. Po vložení textu přílohy stačí spustit nástroj výše.

## Nová měna

- Kurzy přebírá aplikace z denního kurzovního lístku ČNB, takže každá měna, kterou ČNB vyhlašuje, funguje bez úprav. Včetně kurzu za 100 jednotek (např. JPY).
- Do nabídky měn ve formuláři se přidává v [`apps/web/src/model/countries.ts`](../apps/web/src/model/countries.ts) (`currencyOptions`).
- Měna bez desetinných míst se doplní do `ZERO_DECIMAL` v [`packages/rules/src/currency.ts`](../packages/rules/src/currency.ts).

## Nový stát v nabídce

Státy ve formuláři jsou v `CODES` v [`apps/web/src/model/countries.ts`](../apps/web/src/model/countries.ts). Názvy doplní prohlížeč česky podle kódu ISO. Sazba stravného pro stát se bere ze sady pravidel. Když tam chybí, aplikace požádá o ruční zadání.

## Kurzy ČNB na serveru

- Server (`apps/server`) poskytuje `GET /api/kurzy?datum=RRRR-MM-DD` a stahuje denní kurzovní lístek z adresy v proměnné `CNB_URL` (výchozí je oficiální adresa ČNB).
- Lístky za uplynulé dny se ukládají do mezipaměti v paměti a v adresáři `RATE_CACHE_DIR`, protože se zpětně nemění.
- Ve firemní síti bez přístupu na internet lze `CNB_URL` nasměrovat na interní zrcadlo. Případně si uživatelé kurz zadají ručně, aplikace to umožňuje vždy.
