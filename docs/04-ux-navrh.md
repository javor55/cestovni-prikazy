# Etapa 2 – UX návrh

> **Poznámka (21. 10. 2026):** prototyp popisuje původní průvodce v 9 krocích. Aplikace má 12 kroků (navíc Podpis, Kompletní PDF a Exporty), krok Vozidlo je vždy a volbou „použil(a) jsem osobní vozidlo“ se zapne. Aktuální podobu obrazovek ukazují screenshoty v [README](../README.md#jak-to-vypadá).

Klikací prototyp: **https://claude.ai/artifact/QQYmeWsMRQ9Q1aqLUPnjx8** (soukromý, otevře ho jen vlastník, sdílet lze z menu Share).
Zdrojové soubory prototypu jsou v [`design/ux-prototyp/`](../design/ux-prototyp). Jde o formát návrhového plátna, nejsou to soubory budoucí aplikace a samostatně se v prohlížeči neotevřou.

Data v prototypu vycházejí z ukázkové cesty z [etapy 3](03-navrh-dokumentu.md). Částky v prototypu jsou z doby před dokončením výpočetního jádra: stravné za 16. 10. je v něm 15 EUR a výsledek 11 958 Kč, podle jádra 20 EUR a 12 079 Kč.

## Obrazovky

Mobilní obrazovky (390 × 844 px) jsou propojené odkazy. Na plátně se spouštějí tlačítkem Play.

| # | Obrazovka | Co ukazuje | Interaktivní |
|---|---|---|---|
| 1 | Úvod | Informace o lokálním ukládání a 30denní lhůtě, nová cesta, import projektu, rozpracované cesty s datem smazání | odkazy |
| 2 | Založení cesty (Kdo cestuje) | Zaměstnanec, zaměstnavatel, volba podnikatelská / platová sféra srozumitelnými slovy, zapamatování údajů | odkazy |
| 3 | Časová osa | Úseky jako karty, přechod hranice, pobyt mezi úseky, varování u chybějícího přechodu hranice, rychlé přidání zpáteční cesty | odkazy |
| 4 | Jídla | Snídaně, oběd a večeře po dnech, živý přepočet stravného včetně krácení, hromadná volba „snídaně v ceně hotelu“ | **přepínání jídel přepočítává stravné** |
| 5 | Výdaje | Seznam výdajů s měnou, přepočtem a stavem dokladů, výrazné tlačítko „Vyfotit doklad“ | odkazy |
| 6 | Nahrání dokladu (mobil) | Náhled fotky, otočení, oříznutí, více stran, typ dokladu, přiřazení k výdaji, rada k bankovním výpisům | **otočení, typ dokladu, strany** |
| 7 | Souhrn | Částka k výplatě, rozbalovací rozpis stravného a zálohy, odkaz na varování, verze pravidel | rozbalování |
| 8 | Kontrola chyb | Chyby / varování / informace (ikonou, barvou i textem), přímé odkazy na opravu, lhůta pro odevzdání, datum smazání | odkazy |
| 9 | Náhled PDF | Volba vzhledu (moderní / konzervativní), náhled, stažení, samostatný tisk části A předem, výzva k uložení projektu | **přepínání vzhledu** |
| 10 | Návrat s podepsaným dokumentem | Sken / fotky stran (pořadí, otočení, odstranění, kontrola počtu stran) nebo PNG podpis s velikostí a povinným upozorněním | **přepínání režimu, velikost podpisu** |
| 11 | Kompletní PDF a export | Počty stran, dokladů a výdajů bez dokladu, velikost, stažení PDF, XLSX, CSV, JSON, ZIP originálů a projektu, smazání dat s potvrzením a potvrzením o dokončení | **smazání s potvrzením** |
| – | Desktop – souhrn | Navigace kroků se stavem (hotovo / varování), souhrnné karty a tabulky. Tabulky jsou jen na desktopu, mobil používá karty. | – |

## Klíčová rozhodnutí v návrhu

- **Průvodce v 9 krocích** s ukazatelem průběhu: 1 kdo cestuje, 2 údaje o cestě, 3 průběh, 4 jídla, 5 výdaje, 6 vozidlo, 7 souhrn, 8 kontrola, 9 PDF. Krok 6 se zobrazí jen tehdy, když časová osa obsahuje vozidlo. Obrazovky 2 (údaje o cestě) a 6 (vozidlo) nejsou v prototypu nakreslené, protože jde o běžné formuláře se stejnými prvky jako krok 1.
- **Krok se dá kdykoliv opustit** (vše se ukládá automaticky). Tlačítko „Pokračovat“ chybou neblokuje. Blokující chyby zastaví až vytvoření PDF v kroku 8.
- **Varování přímo u položky** (oranžový rámeček + ikona + text) a souhrnně v kroku 8 s odkazem „Doplnit“. Informace se nikdy nepředávají jen barvou.
- **Fotka dokladu jako hlavní cesta k výdaji.** Na mobilu je „Vyfotit doklad“ primární akce, ruční zadání je sekundární.
- **Kurz z potvrzení banky** se nabídne, jakmile je u výdaje přiložen doklad typu „Potvrzení platby“ (R4).
- **Výzva k uložení projektu** se objeví ve chvíli, kdy je pravděpodobný návrat (po stažení PDF k podpisu), ne hned na začátku.
- **Smazání dat** je dostupné vždy (v hlavičce na desktopu, v exportu na mobilu). Potvrzení připomene, kdy byl naposledy stažen projekt.
- **Přístupnost:** skutečné prvky `button`, `a`, `label` a `input`, dotykové plochy alespoň 44 px, kontrast textu alespoň 4,5 : 1, `aria-pressed` u přepínačů, `aria-current` u aktivního kroku.

## Vizuální styl

Neutrální, úřední, ale přátelský vzhled. Písmo Inter, jedna akcentní barva (modrá #1F4FA8), oranžová pro varování a červená jen pro mazání. Barvy se liší i světlostí, takže jsou rozlišitelné i pro barvoslepé. V aplikaci se písmo načte z vlastního serveru, ne z Google Fonts (§ 7 analýzy, S5).

## K připomínkám

1. Odpovídá pořadí kroků tomu, jak zaměstnanci cestu skutečně vyplňují? Alternativou je zadávat výdaje průběžně během cesty, na to je obrazovka 5 připravená a je dostupná i mimo průvodce.
2. Má být „Jen cestovní příkaz (část A) k podpisu předem“ výraznější? Pokud se ve firmě příkaz podepisuje vždy před cestou, mohl by to být samostatný první milník průvodce.
3. Formulace u volby podnikatelská / platová sféra.
