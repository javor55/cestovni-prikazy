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

1. Stáhněte PDF vyhlášky z webu MF a převeďte ho na text se zachováním sloupců: `pdftotext -layout vyhlaska.pdf priloha.txt`. Zalomené názvy měn („americký / dolar“) nevadí. U zalomeného názvu státu (např. „Korejská lidově demokratická / republika“) spojte řádky ručně.
2. Spusťte:

   ```
   pnpm --filter @cp/rules exec tsx scripts/foreign-import.ts ../../priloha.txt data/cz-2027.json
   ```

3. Nástroj převede české názvy států na kódy ISO:
   - **Skupiny území** s odkazem na poznámku pod čarou (např. „Karibik – ostrovní státy³⁾“) rozepíše na jednotlivá území podle poznámky. Poznámky proto musí být v textu také.
   - Řádek **„Ostatní země neuvedené v příloze“** uloží jako `foreign.otherCountries`. Stát, který v příloze není, pak dostane tuto sazbu a aplikace na to upozorní.
   - Pokud název nezná, skončí s výpisem neznámých názvů. Doplňte je do `ALIASES` v [`scripts/foreign-import.ts`](../packages/rules/scripts/foreign-import.ts) a spusťte znovu.
4. Zkontrolujte rozdíl v gitu: počet států, měny a několik namátkových sazeb proti PDF. Test v `rules.test.ts` kontroluje vzorek sazeb – pro nový rok ho upravte.
5. Do `sources` doplňte číslo vyhlášky a `url` s odkazem na úplné znění. Aplikace odkazy ukazuje v Souhrnu u pravidel výpočtu.

> **Stav pro rok 2026:** úplná příloha vyhlášky č. 489/2025 Sb. je v aplikaci (227 států a území, ostatní země 35 EUR), převzatá z PDF Ministerstva financí. Austrálie není v příloze uvedena jmenovitě (skupina „Austrálie a Oceánie – ostrovní státy“ podle poznámky zahrnuje jen ostrovní státy), proto pro ni aplikace použije sazbu pro ostatní země a upozorní (otázka Ú-28 pro účetní).

## Nová měna

- Kurzy přebírá aplikace z denního kurzovního lístku ČNB, takže každá měna, kterou ČNB vyhlašuje, funguje bez úprav. Včetně kurzu za 100 jednotek (např. JPY).
- Do nabídky měn ve formuláři se přidává v [`apps/web/src/model/countries.ts`](../apps/web/src/model/countries.ts) (`currencyOptions`).
- Měna bez desetinných míst se doplní do `ZERO_DECIMAL` v [`packages/rules/src/currency.ts`](../packages/rules/src/currency.ts).

## Nový stát v nabídce

Státy ve formuláři jsou v `CODES` v [`apps/web/src/model/countries.ts`](../apps/web/src/model/countries.ts). Názvy doplní prohlížeč česky podle kódu ISO. Nabídka obsahuje nejčastější státy (asi 60), sazby má sada pravidel pro všech 227 států a území z přílohy. Sazba stravného se bere ze sady pravidel. Stát, který v příloze není, dostane sazbu pro ostatní země a aplikace upozorní. Ruční zadání aplikace nabídne, jen když sada nemá ani sazbu pro ostatní země.

## Kurzy ČNB na serveru

- Server (`apps/server`) poskytuje `GET /api/kurzy?datum=RRRR-MM-DD` a stahuje denní kurzovní lístek z adresy v proměnné `CNB_URL` (výchozí je oficiální adresa ČNB).
- Lístky za uplynulé dny se ukládají do mezipaměti v paměti a v adresáři `RATE_CACHE_DIR`, protože se zpětně nemění.
- Ve firemní síti bez přístupu na internet lze `CNB_URL` nasměrovat na interní zrcadlo. Případně si uživatelé kurz zadají ručně, aplikace to umožňuje vždy.
