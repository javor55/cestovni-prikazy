# Etapa 1 – Analýza

Stav: **schváleno zadavatelem 21. 10. 2026** (otázky pro účetní zůstávají otevřené)
Vstup: `zadani_aplikace_cestovni_prikazy.md` (dále „zadání“) a odpovědi zadavatele z 21. 10. 2026.

Legislativní body označené **Ú-n** jsou otázky pro účetní. Jejich úplný seznam je v [`02-otazky-pro-ucetni.md`](02-otazky-pro-ucetni.md). Tam, kde se uvádí výklad zákona, jde o můj pracovní předpoklad, ne o závazný výklad. Výpočet bude vždy konfigurovatelný a předpoklad zůstane označený, dokud ho účetní nepotvrdí.

---

## 1. Shrnutí zadání

Veřejná webová aplikace bez registrace, ve které **zaměstnanec** připraví cestovní příkaz a vyúčtování pracovní cesty, nechá si spočítat náhrady podle zákoníku práce (zákon č. 262/2006 Sb., dále „ZP“), připojí doklady a vytvoří PDF k podpisu. Po podpisu vytvoří kompletní PDF se všemi doklady a **odevzdá ho účetní**. Aplikace musí fungovat na mobilu i počítači, exportovat data do XLSX, CSV a JSON a umožnit uložení a znovunačtení rozpracované cesty.

Stejný kód má později běžet ve firemní síti a architektura nesmí bránit pozdějšímu doplnění účtů, organizací, rolí a schvalování.

## 2. Rozhodnutí zadavatele (21. 10. 2026)

| # | Téma | Rozhodnutí |
|---|---|---|
| R1 | Uživatel | Zaměstnanec, který výsledný dokument odevzdá účetní. |
| R2 | Ověření legislativy | Výpočty a vzorové příklady ověří účetní. |
| R3 | Sazby | Stačí aktuální rok (2026). |
| R4 | Kurzy | Výchozí kurz z ČNB. Je-li u výdaje doloženo potvrzení z bankovnictví, použije se přepočet z potvrzení, tj. skutečně stržená částka v Kč. |
| R5 | Provoz | Zatím veřejný web (Ubuntu VM nebo bezplatný hosting na testování), později firemní síť. |
| R6 | Ukládání | **Soubory ani data se ideálně nikam na server neukládají.** |
| R7 | Postup | Práce v PR, autor po sobě vždy zkontroluje vlastní výstup. |
| R8 | Jazyk | Pouze čeština, pouze česká legislativa. |
| R9 | Mezery v zadání | Doplnit tak, aby výsledek odpovídal legislativě a byl dobře použitelný. |
| R10 | Architektura | Schválena lokální architektura (§ 3) a doba uchování 30 dní nečinnosti. |

### 2.1 Odpověď na dotaz k R3: lze sazby tahat z ČNB?

Ne. ČNB vyhlašuje pouze **měnové kurzy**. Sazby cestovních náhrad vydávají ministerstva vyhláškou, obvykle jednou ročně:

- **MPSV**: tuzemské stravné, základní náhrada za km a průměrné ceny pohonných hmot a elektřiny,
- **MF**: základní sazby zahraničního stravného pro jednotlivé státy.

Vyhlášky nemají strojově čitelné API. Sazby proto budou v aplikaci uložené jako verzovaný datový soubor se zdrojem (číslo vyhlášky) a jednou ročně se aktualizují. Postup aktualizace bude popsaný v dokumentaci. Z ČNB se automaticky stahují jen kurzy.

### 2.2 Vysvětlení k otázce „podnikatelská vs. platová sféra“

ZP rozlišuje dva režimy podle toho, **kdo je zaměstnavatel**:

| | Podnikatelská sféra | Platová sféra |
|---|---|---|
| Kdo | soukromé firmy, OSVČ se zaměstnanci, většina obchodních společností | stát, kraje, obce, státní fondy, příspěvkové organizace, školské právnické osoby a další subjekty podle § 109 odst. 3 ZP |
| Tuzemské stravné | zákonem stanovené **minimum**, zaměstnavatel může dát víc | pevné **rozpětí** (od–do), zaměstnavatel volí v jeho rámci |
| Zahraniční stravné | základní sazba podle vyhlášky MF, s možností úpravy zaměstnavatelem | základní sazba podle vyhlášky MF, pravidla úprav jsou přísnější |
| Soukromé vozidlo | náhrada, pokud bylo použito na žádost (se souhlasem) zaměstnavatele | navíc pravidlo pro použití vozidla na žádost zaměstnance |

**Návrh:** v kroku „Zaměstnavatel“ bude volba *Soukromá firma (podnikatelská sféra)* / *Státní nebo veřejná instituce (platová sféra)* s krátkou nápovědou. Výchozí volba bude podnikatelská sféra. U podnikatelské sféry se použije zákonné minimum, pokud uživatel nezadá vyšší sazbu podle vnitřního předpisu firmy. Zaměstnanec vnitřní předpis často nezná, proto bude u pole vysvětlení „zeptejte se účetní“.

Přesný rozsah rozdílů, které musí MVP pokrýt, potvrdí účetní (**Ú-1, Ú-2**).

---

## 3. Zásadní změna oproti zadání: lokální provoz bez serverového úložiště (R6)

Zadání počítá se serverovou anonymní relací (token, odkaz, PostgreSQL, S3, antivir, serverové mazání). Rozhodnutí R6 vede k jiné a jednodušší architektuře, kterou navrhuji pro MVP:

> **Veškerá data cesty a všechny přílohy zůstávají v prohlížeči uživatele.** Výpočty, generování PDF, slučování dokladů a exporty probíhají v prohlížeči. Server jen doručuje aplikaci (statické soubory) a zprostředkovává kurzy ČNB, ve kterých nejsou žádné osobní údaje.

### 3.1 Co se tím mění

| Požadavek zadání | Řešení v MVP |
|---|---|
| Anonymní relace, token, odkaz pro pokračování (§ 6.1) | Cesta se ukládá v prohlížeči (IndexedDB). Pokračovat lze ve **stejném prohlížeči** nebo na jiném zařízení přes **pracovní projekt (ZIP)**. Odkaz pro pokračování neexistuje, protože data nejsou na serveru. |
| Upozornění o ukládání (§ 6.2) | Text se upraví: „Data se ukládají pouze v tomto prohlížeči. Nikam se neodesílají. Pro přenos na jiné zařízení nebo zálohu si stáhněte pracovní projekt.“ |
| Automatické mazání po 7 dnech (§ 6.3) | Lokální automatické mazání po nastavitelné době nečinnosti. Navrhuji výchozí **30 dní**, protože se data nikam neodesílají a podpis u nadřízeného může trvat déle. Před smazáním se při otevření aplikace zobrazí upozornění. *(schváleno, R10)* |
| Ruční smazání (§ 6.5) | Beze změny. Smaže data cesty z prohlížeče. Navíc bude volba „Smazat všechna data aplikace v tomto prohlížeči“. |
| PostgreSQL, S3 (§ 26) | V MVP není potřeba. Datový model je navržený tak, aby šel později uložit na server (viz § 8). |
| Antivirová kontrola, rate limiting, ochrana sdílených URL (§ 25) | Soubory neopouštějí zařízení, proto odpadá antivir i serverová kontrola přístupu. Zůstává validace formátu (magická čísla souborů), limity velikosti, ochrana proti XSS a bezpečný import ZIP. Rate limiting jen u endpointu kurzů. |
| GDPR a role provozovatele | Provozovatel osobní údaje uživatelů nezpracovává, protože k němu nedoputují. Stačí stručná stránka „Ochrana soukromí“, která to vysvětlí. Žádná analytika, cookies ani skripty třetích stran. |
| Akceptační kritérium 17 „vrátit se k relaci“ | Splněno znovuotevřením ve stejném prohlížeči nebo importem projektu. |
| Akceptační kritérium 24 „ověřit, že data po retenční době zmizí“ | Ověřuje se lokálně (automatický test s posunutým časem). |

### 3.2 Výhody

- Žádná citlivá data (bankovní potvrzení, podpisy) na serveru. Odpadá největší provozní a právní riziko veřejné služby, tedy anonymní upload zneužitelný jako hosting souborů.
- Provoz je téměř zdarma: jeden malý kontejner bez databáze.
- Jednodušší nasazení do firemní sítě: stejný kontejner, žádná data k zálohování.

### 3.3 Nevýhody a omezení

| Omezení | Zmírnění |
|---|---|
| Vyfocení účtenky na mobilu a dokončení na PC vyžaduje přenos ZIP (e-mailem, přes cloud uživatele). | Celý proces jde dokončit i na mobilu. Export a import projektu bude jedno tlačítko a na mobilu se nabídne systémové „Sdílet“. |
| Smazání dat prohlížeče (anonymní okno, čištění, iOS po delší nečinnosti) smaže rozpracovanou cestu. | Výrazné doporučení stáhnout projekt, požadavek na trvalé úložiště (`navigator.storage.persist()`), upozornění v anonymním okně. |
| Výkon a paměť při slučování velkého PDF na starším telefonu (zejména iOS Safari). | Zmenšování fotek před vložením (výchozí cca 200 DPI, JPEG), limity velikosti, zobrazení průběhu. Bude ověřeno testem s 50 přílohami. |
| Nelze vygenerovat PDF pomocí serverového Chromia (nejvěrnější HTML→PDF). | PDF se skládá přímo knihovnou v prohlížeči (viz § 9). Vzhled je plně kontrolovaný a výsledek deterministický. |

### 3.4 Budoucí firemní verze

Výpočetní jádro, datový model a generování dokumentů budou samostatné balíčky bez závislosti na prohlížeči. Firemní verze pak přidá server (účty, organizace, schvalování, archiv) a bude používat **stejné** jádro. Lokální režim může zůstat jako „anonymní režim“.

---

## 4. Předpoklady

| # | Předpoklad | Ověří |
|---|---|---|
| P1 | Zaměstnanec má pracovní poměr (ne DPP/DPČ s odlišnou dohodou, ne jednatel bez pracovní smlouvy). Pro DPP/DPČ ZP cestovní náhrady také přiznává, výpočet je stejný. | účetní (Ú-3) |
| P2 | Pravidelné pracoviště je v ČR. | – |
| P3 | Všechny časy se zadávají a počítají v **českém místním čase** (Europe/Prague), včetně zahraničních úseků. Aplikace u zahraničního času zobrazí nápovědu. Zahraniční místní čas lze volitelně zadat a aplikace ho přepočte. | účetní (Ú-9) |
| P4 | Cesta trvá nejvýše desítky dní (UI a PDF se optimalizují pro 1–30 dní, technický limit 366 dní). | – |
| P5 | Jedna cesta = jeden zaměstnanec. Spolucestující nejsou v MVP (každý si vytvoří vlastní cestu). | – |
| P6 | Výsledná měna vyúčtování je CZK. Zahraniční stravné a záloha v cizí měně se vedou v původní měně a přepočítávají se podle pravidel (§ 6.6). | účetní (Ú-10) |
| P7 | Vyúčtování probíhá po skončení cesty. Cestovní příkaz (část A) se ale dá vytisknout i předem jako plán. | – |
| P8 | Jde o papírový proces: PDF se tiskne, podepisuje a odevzdává účetní, případně se odevzdá sken. Kvalifikovaný elektronický podpis není potřeba. | – |
| P9 | Podporované prohlížeče: poslední 2 verze Chrome, Edge, Firefox a Safari (desktop i mobil). | – |

---

## 5. Doplnění mezer v zadání (R9)

Zadání neobsahuje několik věcí, které ZP upravuje nebo které jsou pro použitelnost důležité. Navrhuji je doplnit do MVP:

| # | Doplnění | Popis | Stav |
|---|---|---|---|
| D1 | **Kapesné** (zahraniční cesta) | ZP umožňuje zaměstnavateli poskytnout kapesné do výše 40 % zahraničního stravného. Je dobrovolné, proto výchozí hodnota bude „neposkytuje se“ a uživatel může zadat procento podle pokynu zaměstnavatele. | Ú-11 |
| D2 | **Tuzemská část zahraniční cesty** | Za dobu strávenou v ČR (cesta na hranici a zpět) náleží tuzemské stravné podle tuzemských pravidel, zahraniční stravné za dobu v zahraničí. Výpočet obě části oddělí a v rozpisu je zobrazí zvlášť. | Ú-5 |
| D3 | **Elektromobil a plug-in hybrid** | Náhrada za spotřebovanou elektřinu (kWh/100 km, průměrná cena elektřiny z vyhlášky MPSV, nebo doložená cena). U plug-in hybridu se volí jeden způsob. | Ú-13 |
| D4 | **Přerušení cesty / soukromá část** | Úsek lze označit „soukromý pobyt“. Ten se nezapočítává do doby pro stravné a výdaje v něm aplikace označí jako nenáhradové. | Ú-14 |
| D5 | **Letecká doprava a přechod hranice** | U letu se jako okamžik přechodu hranice nabídne čas odletu z posledního (příletu na první) letiště v ČR. Jde o běžnou praxi, je ale třeba potvrdit. | Ú-7 |
| D6 | **Lhůta pro vyúčtování** | ZP stanoví zaměstnanci lhůtu pro předložení dokladů k vyúčtování (10 pracovních dnů od ukončení cesty, nedohodnou-li se jinak). Aplikace zobrazí informativní upozornění s datem. | Ú-15 |
| D7 | **Tankování během cesty a náhrada za PHM** | Při více dokladech o tankování aplikace navrhne cenu podle pravidel (např. poslední doklad / průměr) a výběr bude vidět ve výpočtu. | Ú-12 |
| D8 | **Spotřeba podle TP se třemi údaji** | Pokud technický průkaz uvádí spotřebu pro tři režimy, použije se jejich aritmetický průměr. Kombinovaná (WLTP) hodnota se použije přímo. | Ú-12 |
| D9 | **Přechod letního/zimního času** | Den se 23 nebo 25 hodinami se počítá správně podle skutečně uplynulé doby. Pokryto testem. | – |
| D10 | **Výdaje uhrazené zaměstnavatelem přímo** (např. letenka koupená firmou) | Zahrnou se do přehledu nákladů, ne do částky k vyplacení. Zadání to uvádí, rozvádím: výchozí plátce se odvozuje ze způsobu úhrady. | – |
| D11 | **Firemní vozidlo** | Při firemním vozidle se neposkytuje náhrada za km ani za PHM. Tankování firemní kartou se jen eviduje pro přehled nákladů. | – |
| D12 | **Ubytování se snídaní** | Snídaně zahrnutá v ceně ubytování hrazeného zaměstnavatelem (nebo proplaceného zaměstnanci) se považuje za bezplatné jídlo a krátí stravné. Aplikace to při zadání ubytování připomene. | Ú-6 |
| D13 | **Účel cesty v PDF a schválení předem** | Část A (cestovní příkaz) lze vytisknout zvlášť, aby ji nadřízený mohl podepsat před cestou. | – |
| D14 | **Vratka / doplatek u zálohy v cizí měně** | Rozdíl se vypočítá v měně zálohy a přepočte podle pravidla kurzu zálohy. | Ú-10 |

Mimo MVP navrhuji ponechat:
- cesty zaměstnanců s místem výkonu práce mimo pravidelné pracoviště (§ 155 ZP, např. stavbyvedoucí),
- náhradu za přestěhování, cesty do místa bydliště při delší cestě,
- spolujízdu více zaměstnanců jedním vozem,
- jiné cílové měny vyúčtování než CZK.

---

## 6. Legislativní a účetní rizika

Seřazeno podle dopadu. Každé riziko bude ve výpočetním modulu řešené konfigurovatelně, s vazbou na otázku pro účetní.

| # | Riziko | Dopad | Opatření |
|---|---|---|---|
| L1 | Chybné sazby (přepis vyhlášky, nesprávný rok) | Chybná částka ve všech cestách | Sazby jako data se zdrojem, automatický test na kontrolní součty (počet zemí, vybrané hodnoty), kontrola účetní. |
| L2 | Chybný výklad doby pro stravné (rozhodná doba, půlnoc, tuzemská + zahraniční část v jednom dni) | Chybné stravné u složitějších cest | Vzorové příklady od účetní jako automatické testy. Rozpis výpočtu po dnech v aplikaci i PDF. |
| L3 | Rozhodující stát při více státech v jednom dni | Jiná sazba a měna | Pravidlo konfigurovatelné, výchozí podle potvrzení účetní (Ú-4). |
| L4 | Krácení za bezplatná jídla (procenta podle délky, základ krácení) | Chybné stravné | Pravidla krácení jako data, test pro každé pásmo. |
| L5 | Kurz (záloha vs. vyúčtování, doklad o směně, kartová platba) | Kurzový rozdíl ve vyúčtování | Typ kurzu u každé částky (ČNB / doklad o směně / bankovní potvrzení / ruční), viditelný v PDF. R4 implementováno přímo. |
| L6 | Zaokrouhlování | Rozdíly v haléřích až korunách | Pravidla zaokrouhlení v sadě pravidel, ne v kódu UI. Výchozí návrh v Ú-8. |
| L7 | Změna sazeb během cesty (cesta přes 31. 12.) | Chybná sazba pro část dní | Sazba se volí **podle data každého dne**. Pro MVP stačí rok 2026 (R3). Cesta přes přelom roku zobrazí blokující chybu „chybí sazby pro rok 2027“, dokud nebudou doplněny. |
| L8 | Podnikatelská vs. platová sféra | Jiné limity | Volba u zaměstnavatele (§ 2.2). |
| L9 | Uživatel zadá chybné údaje (časy, jídla) | Chybné vyúčtování | Validace, varování, srozumitelný rozpis. Konečnou kontrolu dělá účetní, PDF obsahuje vše potřebné k ověření. |
| L10 | Daňová stránka (stravné nad limit platové sféry je u zaměstnance zdanitelné) | Mimo rozsah aplikace | Informativní upozornění, pokud zadaná firemní sazba překročí horní hranici platové sféry. |

**Zásada:** aplikace nikde nevydává částku za „správnou ze zákona“. V PDF bude uvedeno: „Výpočet podle sady pravidel *CZ-2026-podnikatelská v1.0* (vyhláška MPSV č. …/2025 Sb., vyhláška MF č. …/2025 Sb.).“

---

## 7. Bezpečnostní a soukromá rizika (v lokální architektuře)

| # | Riziko | Opatření |
|---|---|---|
| S1 | XSS (vstup uživatele, názvy souborů, importovaný projekt) | React s escapováním, zákaz `dangerouslySetInnerHTML`, přísná CSP (`script-src 'self'`, bez inline skriptů), validace importu schématem (zod). |
| S2 | Škodlivý importovaný ZIP (zip bomb, obrovské soubory, nečekané soubory, path traversal) | Limit počtu a celkové rozbalené velikosti, kontrola kontrolních součtů, přijetí jen souborů uvedených v manifestu, cesty se nikdy nepoužijí jako cesty na disku. |
| S3 | Škodlivý soubor jako příloha (PDF s JavaScriptem, polyglot) | Ověření formátu podle magických čísel, PDF se v aplikaci jen rasterizuje nebo vkládá jako stránky (pdf-lib nespouští JS), náhled přes `pdf.js` bez skriptování, obrázky přes `<img>`/canvas. |
| S4 | Sdílený počítač – data zůstanou v prohlížeči | Upozornění na úvodní obrazovce, výrazné tlačítko „Smazat“, automatické mazání po nečinnosti. |
| S5 | Únik dat přes třetí strany | Žádná analytika, CDN, fonty ani skripty z cizích domén. Vše je self-hosted. |
| S6 | Zneužití endpointu kurzů | Pouze GET s validovaným datem a kódem měny, odpovědi cachované, rate limiting v reverse proxy. Proxy volá pouze pevně danou adresu ČNB (žádné SSRF). |
| S7 | Podvržení aplikace (supply chain) | Zámek závislostí, `npm audit` v CI, Dependabot, minimum závislostí. |
| S8 | Citlivé údaje v bankovních dokumentech | Doporučení nahrát jen potvrzení konkrétní transakce. Nástroj pro oříznutí fotky před uložením. Originál se uchová jen lokálně. |
| S9 | Indexace | `robots.txt` a `noindex` jsou méně důležité (soukromá data nejsou na URL), ale přidají se. |

---

## 8. Návrh MVP

### 8.1 Moduly (modulární monorepo)

```
packages/
  core/        výpočetní jádro: model cesty, validace, výpočet stravného, vozidla, kurzů, souhrnu
  rules/       verzované sady pravidel a sazeb (data + schéma), CZ-2026
  documents/   generování PDF (cestovní příkaz, vyúčtování, kompletní dokumentace), XLSX, CSV
  project/     export/import pracovního projektu (ZIP + project.json), migrace schématu
apps/
  web/         uživatelské rozhraní (React), lokální úložiště, práce s přílohami
  server/      malý server: statické soubory + /api/kurzy (proxy a cache ČNB)
```

`core`, `rules`, `documents` a `project` nebudou záviset na prohlížeči ani UI, aby je mohla použít budoucí serverová firemní verze.

### 8.2 Datový model (zjednodušeně)

Všechny entity mají UUID, `createdAt` a `updatedAt`. Částky se ukládají jako celé číslo v nejmenších jednotkách měny (haléře, centy) + kód měny ISO 4217, aby nevznikaly chyby z plovoucí čárky.

```
Trip
  id, schemaVersion, number (CP-2026-0001), purpose, kind (domestic|foreign)
  employerSector (business|public)          // podnikatelská / platová sféra
  employee: { name, personalNumber?, position?, department?, regularWorkplace, address? }
  employer: { name, ico?, seat, unit?, costCenter?, project?, logoAttachmentId? }
  plan:   { start, end, startPlace, endPlace, destinations[], transport[], advance[] }
  actual: { start, end }                    // odvozeno z úseků, lze ověřit
  segments[]:  { id, order, from{place,country}, to{place,country}, departure, arrival,
                 transport, carrier?, connection?, km?, stopPurpose?,
                 borderCrossing?{ at, place? }, private (D4), note? }
  meals[]:     { date, breakfast|lunch|dinner: { free, inAccommodation, paidBy?, note? } }
  expenses[]:  { id, order, category, description, supplier?, date, time?, country,
                 amount: Money, conversion: Conversion, paymentMethod, paidBy,
                 segmentId?, costCenter?, project?, documentNumber?, note?,
                 attachmentIds[] }
  advances[]:  { amount: Money, providedOn, conversion: Conversion }
  vehicle?:    { kind (private|company), owner, plate, type, fuel, consumption, unit,
                 km, odoStart?, odoEnd?, trailer, fuelPrice?: { source: receipt|average, ... },
                 requestedByEmployer, note? }
  employerRates?: { domesticOverride?, foreignAdjustment?, pocketMoneyPercent? }
  attachments[]: { id, kind (accounting|payment|supporting|signedDocument|signature|logo),
                   subtype, originalName, mime, size, sha256, uploadedAt, order,
                   expenseId?, conversion: { status, derivedBlobId? }, pages? }
  calculationSnapshots[]: { id, createdAt, ruleSetId, ruleSetVersion, inputHash, result }
  ownerId?, organizationId?                 // prázdné v MVP, připraveno pro firemní verzi

Money       { amountMinor: integer, currency: 'CZK' | 'EUR' | ... }
Conversion  { rate, rateUnit (např. 1 EUR, 100 JPY), rateDate, source (CNB|EXCHANGE_RECEIPT|
              BANK_CONFIRMATION|MANUAL), resultCzk: Money, manualReason? }
```

Binární data příloh se ukládají v IndexedDB odděleně od JSON (Blob podle `attachmentId`). Pracovní projekt (ZIP) má stejnou strukturu: `project.json` + `attachments/<id>.<ext>` + `manifest.json` s SHA-256.

**Kurz podle R4:** při způsobu úhrady „karta“ nebo „převod“ a přiloženém dokladu typu *potvrzení z bankovnictví* aplikace nabídne zadání **skutečně stržené částky v Kč**. Kurz se dopočítá a uloží se zdroj `BANK_CONFIRMATION`. Bez potvrzení se použije kurz ČNB podle pravidla (Ú-10).

### 8.3 Výpočetní modul

- Čistá funkce `calculate(trip, ruleSet) → CalculationResult` (deterministická, bez I/O, bez aktuálního času).
- Výsledek obsahuje vše pro rozpis: dny, rozhodné doby, stát, základní sazbu, pásmo, krácení po jídlech, zaokrouhlení, mezivýsledky, výsledky, upozornění s kódy.
- Sada pravidel = JSON validovaný schématem: `id`, `validFrom/validTo`, `sector`, tuzemské sazby (pásma), zahraniční sazby (stát → měna, částka), krácení, kapesné, vozidla (sazby za km podle typu), průměrné ceny PHM a elektřiny, zaokrouhlování, zdroj.
- Při generování PDF se uloží **snímek výpočtu**. PDF vždy vzniká ze snímku, ne z živých dat, takže pozdější změna sazeb dokument nezmění.
- Testy: tabulka vzorových příkladů (vstup → očekávané částky) potvrzená účetní. Každý příklad ze zadání (§ 29.1) bude mít vlastní test.

### 8.4 Doporučená technologie

| Oblast | Volba | Důvod |
|---|---|---|
| Jazyk | TypeScript | Podle zadání, sdílený kód jádra mezi prohlížečem a budoucím serverem. |
| UI | React + Vite (SPA), React Router, React Hook Form + zod | Bez serverových dat nepřináší Next.js podstatnou výhodu, Vite SPA se nasazuje jako statické soubory. Budoucí server může být Next.js i jiný, protože jádro je oddělené. |
| Styl | Tailwind CSS + přístupné komponenty (Radix UI) | Mobile-first, přístupnost, malý balík. |
| Lokální úložiště | IndexedDB přes Dexie | Velké přílohy (Blob), transakce, migrace. |
| PDF – tvorba | `@react-pdf/renderer` s vloženým fontem (Noto Sans / Source Sans) | Deterministické PDF v prohlížeči, české i zahraniční znaky, šablony jako komponenty. |
| PDF – slučování, číslování, záložky, podpis | `pdf-lib` (+ `@pdf-lib/fontkit`) | Vkládání stránek z nahraných PDF, PNG podpisu, čísel stran, záložek. |
| PDF – náhled, rasterizace | `pdf.js` | Náhled nahraných PDF a podepsaného skenu. |
| Obrázky | `heic2any` (libheif/WASM) pro HEIC, canvas pro otočení, ořez a zmenšení, `exifr` pro EXIF orientaci | Vše v prohlížeči. |
| XLSX | `ExcelJS` (MIT) | Listy, formáty čísel a dat. |
| ZIP | `fflate` | Rychlý, malý, streamování. |
| Testy | Vitest (jádro, dokumenty), Playwright (E2E, mobilní viewporty, WebKit) | Podle zadání § 29. |
| Server | Node.js (Hono) – statické soubory + `/api/kurzy` s cache | Jeden malý kontejner. |
| Nasazení | Docker (multi-stage), `docker-compose` s Caddy (automatické HTTPS) | Stejný obraz pro web i firemní síť. |

Varianta .NET (zadání § 26) je vhodná, pokud bude firemní verzi rozvíjet .NET tým. S lokální architekturou je ale serverová část minimální a výběr serverové technologie lze odložit do etapy firemní verze. Podrobné porovnání bude v etapě 4.

### 8.5 Hosting na testování

1. **Doporučení: vaše Ubuntu VM** + Docker Compose + Caddy. Potřeba: veřejná IP nebo port forwarding a doména. Bez vlastní domény lze použít bezplatnou subdoménu (např. DuckDNS) a Caddy k ní automaticky získá certifikát Let's Encrypt.
2. **Alternativa zdarma:** Cloudflare Pages (statické soubory) + Pages Function pro kurzy ČNB. Výhodou jsou náhledy pro každý PR. Nevýhodou je mírná vazba na Cloudflare, ta se ale týká jen 20 řádků proxy kurzů. Statická část je přenositelná beze změny.

### 8.6 Výchozí hodnoty otevřených otázek ze zadání (§ 34)

| # | Otázka | Návrh výchozí hodnoty | Stav |
|---|---|---|---|
| 1 | Sféra | Volba uživatelem, výchozí podnikatelská | navrženo (§ 2.2) |
| 2 | Sazba v rozpětí | Podnikatelská: zákonné minimum, lze zadat vyšší. Platová: dolní hranice, lze zvolit v rozpětí. | Ú-2 |
| 3 | Zdroj kurzů | ČNB, denní kurz devizového trhu | rozhodnuto (R4) |
| 4 | Datum kurzu | Viz Ú-10, výchozí podle odpovědi účetní | Ú-10 |
| 5 | Zaokrouhlování | Stravné za den na celé Kč nahoru, přepočty kurzem na haléře, celková částka k výplatě na celé Kč | Ú-8 |
| 6 | Doklad o zaplacení | Nepovinný. Varování u výdaje placeného soukromou kartou bez potvrzení. | navrženo |
| 7 | Limity souborů | 20 MB na soubor, 300 MB na cestu (omezeno úložištěm prohlížeče) | navrženo |
| 8 | Doba uchování | 30 dní nečinnosti, nastavitelné | rozhodnuto (R10) |
| 9 | PDF/A | Ne v MVP. Fonty se vkládají vždy, takže přechod na PDF/A je možný později. | navrženo |
| 10 | Krycí list | Ano, lze vypnout | navrženo |
| 11 | Jazyk | Pouze čeština | rozhodnuto (R8) |
| 12 | Synchronní / fronta | Generování v prohlížeči ve Web Workeru s průběhem. Fronta úloh odpadá. | navrženo |

---

## 9. Uživatelský tok (MVP)

Průvodce kroky, na mobilu jeden krok na obrazovku, na desktopu postranní navigace s přehledem stavu kroků. Každý krok lze kdykoliv opustit a vrátit se (automatické ukládání).

1. **Úvod**: co aplikace dělá, kde jsou data uložena, „Nová cesta“, „Načíst projekt (ZIP)“, seznam rozpracovaných cest v tomto prohlížeči.
2. **Zaměstnanec a zaměstnavatel**: údaje se zapamatují pro příští cestu (lokálně, s možností smazat).
3. **Základní údaje cesty**: účel, tuzemská/zahraniční, plán (začátek, konec, místa, doprava), záloha. → *Lze vytisknout část A (cestovní příkaz) k podpisu předem.*
4. **Časová osa**: úseky jako karty, rychlé přidání zpáteční cesty, přechody hranic, soukromé úseky.
5. **Jídla**: tabulka/karty po dnech (generované z časové osy), rychlá volba „snídaně v ceně ubytování po celou dobu“.
6. **Výdaje**: seznam karet, nový výdaj s fotkou dokladu, kategorie, způsob úhrady, kurz.
7. **Vozidlo**: jen pokud je v úsecích použito soukromé nebo firemní vozidlo.
8. **Souhrn a kontrola**: rozpis stravného po dnech, výdaje, vozidlo, záloha, výsledek, chyby / varování / informace s odkazem na místo opravy.
9. **PDF k podpisu**: volba vzhledu, náhled, stažení. Současně výzva „Stáhněte si pracovní projekt“.
10. **Podepsaný dokument**: nahrání skenu/fotek (pořadí, otočení, odstranění stránky), nebo vložení PNG podpisu / razítka do podpisového pole.
11. **Kompletní PDF a exporty**: shrnutí (počet stran, doklady, výdaje bez přílohy, velikost), stažení kompletního PDF, XLSX, CSV, JSON, ZIP originálů.
12. **Smazání dat**: dostupné kdykoliv z hlavičky, s potvrzením.

---

## 10. Návrh dalších etap

| Etapa | Výstup |
|---|---|
| 2 – UX návrh | Klikací prototyp v HTML (mobil + desktop) pro obrazovky ze zadání § 30. |
| 3 – Návrh dokumentů | Dvě skutečně vygenerovaná ukázková PDF (konzervativní a moderní) s fiktivními daty, porovnání výhod a nevýhod. |
| 4 – Technický návrh | Architektonický diagram, finální datový model a schéma sad pravidel, proces PDF a importu/exportu, bezpečnostní model, testovací strategie, nasazení. |
| 5 – Implementace MVP | Milníky (níže), každý jako samostatný PR s testy a popisem. |
| 6 – Ověření | Vzorové výpočty s účetní, kontrola PDF, mobilní testy, dokumentace. |

Milníky implementace:

1. Výpočetní jádro + sady pravidel 2026 + testy vzorových příkladů.
2. Formuláře průvodce + lokální ukládání + validace.
3. Přílohy (focení, HEIC, ořez, otočení) + kurzy ČNB.
4. PDF k podpisu (zvolený vzhled).
5. Podepsaný dokument, PNG podpis, kompletní PDF.
6. Exporty XLSX/CSV/JSON + export/import projektu.
7. Bezpečnostní zpevnění, PWA manifest, Docker, dokumentace, nasazení na testovací prostředí.

Budoucí (mimo MVP): serverová synchronizace a účty, organizace a role, schvalování, firemní šablony a směrnice (vlastní sady pravidel organizace), archiv, OCR účtenek, import transakcí firemních karet, integrace na účetní systémy.

---

## 11. Co potřebuji k pokračování

1. ~~**Zadavatel:** potvrdit lokální architekturu (§ 3) a výchozí dobu uchování 30 dní.~~ Potvrzeno (R10).
2. **Zadavatel:** je Ubuntu VM dostupná z internetu (veřejná IP / port 443) a máte doménu? Případně souhlasíte s Cloudflare Pages pro testování?
3. **Účetní:** odpovědět na otázky v [`02-otazky-pro-ucetni.md`](02-otazky-pro-ucetni.md) a dodat 3–5 skutečných (anonymizovaných) vyúčtování jako vzorové příklady pro testy.
