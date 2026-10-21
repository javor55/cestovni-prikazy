# Otázky pro účetní

Aplikace počítá cestovní náhrady podle zákoníku práce. U následujících bodů potřebujeme potvrdit, jak postupovat. U každé otázky je **návrh výchozího chování** a popis, **jak to aplikace dělá teď** (stav k 21. 10. 2026). Stačí odpovědět „souhlasím“, nebo napsat, jak to má být.

Pokud je pravidlo ve vaší firmě dané vnitřním předpisem, napište prosím i to. Aplikace ho umožní nastavit.

Na konci prosíme o **3–5 vzorových vyúčtování** (stačí anonymizovaná), podle kterých ověříme, že aplikace počítá stejně jako vy.

---

## Obecné

**Ú-1 – Sféra zaměstnavatele**
Je zaměstnavatel soukromá firma (podnikatelská sféra), nebo státní/veřejná instituce (platová sféra)? Má aplikace v MVP podporovat obě?\
*Návrh:* obě, volba u zaměstnavatele, výchozí podnikatelská.\
*Jak je to teď v aplikaci:* Typ zaměstnavatele (soukromá firma, nebo stát/obec/příspěvková organizace) se volí v kroku Kdo cestuje. Výchozí je soukromá firma a volbu si aplikace může zapamatovat pro další cesty.

**Ú-2 – Výše tuzemského stravného**
Platí ve firmě zákonné minimum, nebo vyšší sazby podle vnitřního předpisu? Pokud vyšší, jaké?\
*Návrh:* výchozí zákonné minimum, uživatel může zadat sazby podle vnitřního předpisu.\
*Jak je to teď v aplikaci:* Výchozí jsou zákonné sazby. V části „Sazby podle vnitřního předpisu“ jde pro každé pásmo zadat vlastní sazbu. U soukromé firmy aplikace hlásí chybu, když je sazba pod minimem. U veřejné sféry hlásí chybu, když je mimo zákonné rozpětí.

**Ú-3 – Druh pracovního vztahu**
Počítat stejně i pro dohody (DPP, DPČ)?\
*Návrh:* ano, stejný výpočet.\
*Jak je to teď v aplikaci:* Druh pracovního vztahu se nezadává, všichni se počítají stejně.

**Ú-15 – Lhůty a vnitřní předpis**
Platí zákonná lhůta 10 pracovních dnů pro předložení vyúčtování, nebo jiná podle vnitřního předpisu?\
*Návrh:* aplikace zobrazí informativní upozornění s datem podle zákonné lhůty.\
*Jak je to teď v aplikaci:* V kroku Kontrola aplikace ukáže datum, do kdy je potřeba vyúčtování předložit: 10 pracovních dnů po skončení cesty, bez víkendů a státních svátků. Jinou lhůtu podle vnitřního předpisu zatím nastavit nejde.

**Ú-16 – Požadované doklady**
Které doklady vyžadujete? Stačí účtenka, nebo chcete u plateb soukromou kartou i potvrzení o zaplacení (výpis transakce)? Vyžadujete jízdenky u MHD?\
*Návrh:* účetní doklad je vyžadovaný u každého výdaje (jinak varování), potvrzení o zaplacení je nepovinné (varování u soukromé karty).\
*Jak je to teď v aplikaci:* U výdaje bez účetního dokladu se zobrazí varování „Bez dokladu“. U platby soukromou kartou aplikace při přikládání dokladů připomene potvrzení o zaplacení. Varování v kontrole se ale zobrazí jen u soukromých plateb v cizí měně. U jízdenek MHD nic zvláštního neplatí.

---

## Čas a stravné

**Ú-9 – Časové pásmo**
Zahraniční cesty: zapisují se časy v českém čase, nebo v místním čase země?\
*Návrh:* vše v českém čase. Aplikace umí místní čas přepočítat.\
*Jak je to teď v aplikaci:* Všechny časy se zadávají v českém čase (aplikace to u zadávání připomíná). Změnu letního a zimního času počítá správně. Převod z místního času jiné země zatím neumí.

**Ú-5 – Tuzemská a zahraniční část v jednom dni**
Příklad: odjezd z Prahy v 6:00, přechod hranice v 9:00, celý zbytek dne v Německu. Jak se počítá tuzemské stravné za 3 hodiny v ČR v den odjezdu a v den návratu (sčítá se doba v ČR za oba dny, nebo se počítá zvlášť za každý den)?\
*Návrh:* podle vašeho postupu, prosíme o jeden konkrétní vzorový příklad.\
*Jak je to teď v aplikaci:* Tuzemské stravné se počítá zvlášť za každý kalendářní den podle doby strávené v Česku, doba z různých dnů se nesčítá. Pokud to vnitřní předpis stanoví, jde u čistě tuzemské cesty zapnout sčítání dnů kratších než 5 hodin (krok Kdo cestuje → Sazby podle vnitřního předpisu).

**Ú-4 – Více států v jednom dni**
Podle sazby kterého státu se počítá zahraniční stravné, pokud zaměstnanec v jednom dni projede více státy (např. ČR → Rakousko → Itálie)?\
*Návrh:* stát, ve kterém zaměstnanec v daném dni strávil nejvíce času. Prosíme o potvrzení nebo opravu.\
*Jak je to teď v aplikaci:* Rozhoduje stát, kde zaměstnanec v daném dni strávil nejvíc času. Při shodném čase se použije později navštívený stát.

**Ú-17 – Krácení zahraničního stravného za bezplatná jídla**
Jaká procenta krácení používáte v jednotlivých pásmech a z jakého základu (ze základní sazby, nebo z již poměrně snížené částky)?\
*Návrh:* z částky pro dané pásmo (např. při 2/3 sazby 45 EUR = 30 EUR krátí snídaně 35 % × 30 = 10,50 EUR). Prosíme o potvrzení na příkladu.\
*Jak je to teď v aplikaci:* Krátí se z částky pro dané pásmo (1/3, 2/3, plná sazba), a to o 70 / 35 / 25 %. Příklad z návrhu: 30 − 10,50 = 19,50 EUR, po zaokrouhlení nahoru 20 EUR.

**Ú-18 – Krátké cesty**
Tuzemská cesta kratší než 5 hodin (bez nároku na stravné) a zahraniční cesta s pobytem v zahraničí do 1 hodiny: postupujete podle zákona, nebo poskytujete něco nad rámec?\
*Návrh:* podle zákona. Aplikace u krátkých cest jen vypíše, že nárok nevznikl a proč.\
*Jak je to teď v aplikaci:* U dne, kdy nárok nevznikl, aplikace napíše proč, např. „Doba v Česku … je kratší než 5 hodin – tuzemské stravné nenáleží“. Pobyt v zahraničí kratší než 1 hodina se přičte k tuzemské části a aplikace to vypíše. Nic nad rámec zákona se nepřidává.

**Ú-6 – Snídaně v ceně ubytování**
Snídaně zahrnutá v ceně hotelu: krátíte stravné vždy, nebo jen pokud je na dokladu uvedená samostatně?\
*Návrh:* krátit vždy, když je snídaně součástí uhrazeného ubytování. Aplikace se při zadání ubytování zeptá.\
*Jak je to teď v aplikaci:* Při zadání ubytování se aplikace zeptá, jestli byla v ceně snídaně. Odpověď „Ano“ označí snídani každé ráno po první noci. V kroku Bezplatná jídla jde označení upravit, zrušit jde i dodatečnou odpovědí „Snídaně v ceně nebyla“.

**Ú-7 – Letecká doprava**
Za okamžik přechodu hranice při letu považujete odlet z / přílet na letiště v ČR?\
*Návrh:* ano.\
*Jak je to teď v aplikaci:* U přechodu hranice je nápověda, že u letu se zadává čas odletu z Česka nebo příletu do Česka. Když čas přechodu chybí, aplikace ho odhadne opatrně (u cesty tam počítá zahraničí až od příletu do cíle) a upozorní na to.

**Ú-14 – Přerušení cesty**
Pokud zaměstnanec spojí pracovní cestu se soukromým pobytem, jak postupujete (stravné za soukromé dny nenáleží, doprava se proplácí jen v rozsahu pracovní části)?\
*Návrh:* soukromé úseky se nezapočítávají. Aplikace je jen vyznačí a výpočet nechá na kontrole účetní.\
*Jak je to teď v aplikaci:* Úsek jde označit jako „soukromá část cesty“ a v PDF je tak vyznačený. Jeho doba se do stravného automaticky nezapočítá. Výdaje za dopravu se nekrátí – ty posoudí účetní.

**Ú-11 – Kapesné**
Poskytuje firma u zahraničních cest kapesné? Pokud ano, kolik procent zahraničního stravného?\
*Návrh:* výchozí neposkytuje se.\
*Jak je to teď v aplikaci:* Kapesné se ve výchozím stavu neposkytuje. U sazeb podle vnitřního předpisu jde zadat procento, nejvýše 40 %.

---

## Měny a kurzy

**Ú-10 – Kurzy a záloha v cizí měně**
1. Jaké datum kurzu ČNB použít pro přepočet výdajů, pokud nebyla záloha (den platby / den nástupu na cestu / den vyúčtování)?
2. Byla-li poskytnuta záloha v cizí měně, přepočítáváte výdaje v této měně kurzem z doby poskytnutí zálohy?
3. Doklad o směně peněz (směnárna, výběr z bankomatu): použijete kurz z dokladu?
4. Platba kartou v cizí měně s potvrzením z bankovnictví: použije se skutečně stržená částka v Kč (takto zadal zadavatel)?
5. Vratka nebo doplatek zálohy v cizí měně: vrací se v cizí měně, nebo v Kč?

*Návrh:* bod 4 ano. Ostatní body nastavíme podle vaší odpovědi.\
*Jak je to teď v aplikaci:* Tlačítko „Načíst kurz ČNB“ bere u výdaje kurz ke dni výdaje, u zahraničního stravného bez zálohy kurz ke dni začátku cesty. Výdaje placené ze zálohy se přepočtou kurzem zálohy automaticky. Kurz z dokladu o směně jde zadat ručně. U platby kartou jde zadat skutečně strženou částku v Kč podle potvrzení banky. Doplatek nebo přeplatek zálohy v cizí měně se spočítá v té měně, přepočte se kurzem zálohy a započte do jedné výsledné částky v Kč.

**Ú-8 – Zaokrouhlování**
Jak zaokrouhlujete?\
*Návrh:* stravné za den na celé Kč nahoru, zahraniční stravné na celé jednotky měny nahoru, přepočet kurzem na haléře, celková částka k výplatě na celé Kč.\
*Jak je to teď v aplikaci:* Stravné za den se zaokrouhluje nahoru – tuzemské na celé Kč, zahraniční na celé jednotky měny. Přepočty kurzem jsou na haléře. Výsledná částka k výplatě se zaokrouhluje matematicky na celé Kč.

---

## Vozidlo

**Ú-12 – Soukromé vozidlo a cena pohonných hmot**
1. Používáte cenu z dokladu o tankování, nebo vždy průměrnou cenu z vyhlášky?
2. Při více tankováních: poslední doklad, průměr, nebo jiný postup?
3. Spotřeba z technického průkazu: při třech údajích (město / mimo město / kombinovaná) průměr tří hodnot, nebo kombinovaná?

*Návrh:* cena z dokladů o tankování, pokud jsou, jinak průměrná cena z vyhlášky. Při více dokladech vážený průměr (Ú-26). Kombinovaná spotřeba, jinak průměr tří hodnot.\
*Jak je to teď v aplikaci:* Způsob ceny paliva volí uživatel: vážený průměr ze všech dokladů o tankování (viz Ú-26), cena z jednoho dokladu, nebo průměrná cena z vyhlášky. Výchozí je průměrná cena z vyhlášky. Když technický průkaz uvádí tři spotřeby, počítá se průměr všech tří hodnot.

**Ú-13 – Elektromobil a plug-in hybrid**
Máte zaměstnance, kteří jezdí soukromým elektromobilem nebo plug-in hybridem? Jak postupujete?\
*Návrh:* elektromobil podle průměrné ceny elektřiny z vyhlášky, plug-in hybrid podle volby uživatele (palivo nebo elektřina).\
*Jak je to teď v aplikaci:* Elektromobil se počítá s průměrnou cenou elektřiny z vyhlášky (7,20 Kč/kWh). Plug-in hybrid jako samostatná volba neexistuje – uživatel vybere buď palivo, nebo elektřinu.

---

## Výsledné dokumenty

**Ú-19 – Co potřebujete v PDF**
Používáte konkrétní tiskopis cestovního příkazu (např. tiskopis SEVT), na který jste zvyklá? Chybí v něm něco, co potřebujete pro zaúčtování (nákladové středisko, zakázka, číslo účtu pro výplatu)?\
*Návrh:* vlastní přehledný formát se vším ze zadání. Pokud preferujete známý tiskopis, uděláme konzervativní variantu co nejblíže jemu.\
*Jak je to teď v aplikaci:* PDF jde vytvořit ve dvou vzhledech: „Moderní“ a „Konzervativní“ (blízký tradičnímu tiskopisu). Obsahuje nákladové středisko a projekt/zakázku. Číslo účtu pro výplatu se zadává u zaměstnance a ve vyúčtování se zobrazí u částky k výplatě.

---

## Doplněno při implementaci výpočtu

**Ú-20 – Nižší krácení v podnikatelské sféře**
Zákoník práce v podnikatelské sféře uvádí krácení „až o“ 70 / 35 / 25 %. Krátíte vždy o plné procento, nebo máte ve směrnici nižší?\
*Návrh:* vždy plné procento.\
*Jak je to teď v aplikaci:* Vždy se krátí o plné procento. Nastavení nižšího krácení zatím neexistuje.

**Ú-21 – Zaokrouhlení spotřebovaného paliva**
Náhrada za PHM = km × spotřeba / 100 × cena. Zaokrouhlujete litry před vynásobením cenou?\
*Návrh:* nezaokrouhlovat litry, zaokrouhlit až výslednou náhradu na haléře (686 km × 5,6 l = 38,416 l × 38,90 Kč = 1 494,38 Kč).\
*Jak je to teď v aplikaci:* Litry se nezaokrouhlují. Zaokrouhlí se až výsledná náhrada na haléře, zaokrouhlené litry se jen zobrazují.

**Ú-22 – Změna průměrné ceny PHM během roku**
V roce 2026 se průměrná cena nafty změnila od 1. 6. a benzinu 95 od 1. 10. Pokud cesta přes tato data přechází, jakou cenu použít?\
*Návrh:* cenu platnou v den začátku cesty. Aplikace na změnu upozorní.\
*Jak je to teď v aplikaci:* Použije se průměrná cena platná v den začátku cesty. Když se během cesty změní, aplikace upozorní (jen u průměrné ceny z vyhlášky).

**Ú-23 – Základ pro kapesné**
Počítá se kapesné z výsledného zahraničního stravného za den (po krácení za jídla)?\
*Návrh:* ano, z výsledného stravného za den.\
*Jak je to teď v aplikaci:* Kapesné se počítá z výsledného zahraničního stravného za den, tedy po krácení a zaokrouhlení.

**Ú-24 – Hraniční časy pásem**
Cesta trvající přesně 12 hodin patří do pásma 5–12 h a přesně 18 hodin do pásma 12–18 h. Pobyt v zahraničí přesně 1 hodinu už zakládá nárok na 1/3 zahraničního stravného. Souhlasí?\
*Návrh:* ano.\
*Jak je to teď v aplikaci:* Přesně 12 hodin patří do pásma 5–12 h a přesně 18 hodin do pásma 12–18 h. Pobyt v zahraničí přesně 1 hodinu už zakládá nárok na 1/3, kratší ne.

**Ú-25 – Průjezd dalšími státy**
Při cestě po zemi (např. autem z Ústí nad Labem do Záhřebu přes Rakousko a Slovinsko) zapisujete čas vjezdu do každého státu, kterým zaměstnanec projíždí, a stravné za den určujete podle státu, ve kterém strávil nejvíc času? Nebo stačí čas přechodu české hranice a celá doba v zahraničí se počítá cílovému státu?\
*Návrh:* zapisovat vjezd do každého státu. Aplikace u pozemní cesty mezi státy, které spolu nesousedí, upozorní na chybějící stát po cestě (varování, ne chyba). Při chybějícím čase započte dobu k sousednímu státu a upozorní.\
*Jak je to teď v aplikaci:* Do úseku jde přidat „stát po cestě“ s časem vjezdu, při převzetí z plánu se doplní ze zadané trasy. U pozemní cesty mezi státy, které spolu nesousedí, aplikace upozorní na chybějící stát. Když chybí čas vjezdu, doba se započte k sousednímu státu a aplikace upozorní.

**Ú-26 – Cena paliva při více tankováních**
Zaměstnanec během cesty tankoval víckrát za různé ceny. Jakou cenu použít pro náhradu za spotřebované palivo?\
*Návrh:* vážený průměr – cena všech tankování ÷ celkové množství (např. 1 500 Kč / 40 l a 1 170,60 Kč / 30,5 l → 37,88 Kč/l). Aplikace umožňuje i cenu z jednoho dokladu nebo průměrnou cenu podle vyhlášky.\
*Jak je to teď v aplikaci:* Vážený průměr je k dispozici (výdaj Pohonné hmoty s vyplněným množstvím), stejně jako cena z jednoho dokladu nebo průměrná cena z vyhlášky. Výchozí je průměrná cena z vyhlášky, uživatel způsob přepne v kroku Vozidlo.

**Ú-27 – Půjčené auto a auto z autopůjčovny**
Auto půjčené od rodiny nebo známého posuzujeme jako vozidlo zaměstnance (náhrada za km a palivo podle § 157 odst. 4 ZP – nejde o vozidlo zaměstnavatele). U auta z autopůjčovny proplácíte nájemné a palivo jako výdaje a náhradu za km neposkytujete?\
*Návrh:* ano. Aplikace u půjčeného auta chce vlastníka a smlouvu o výpůjčce, u autopůjčovny na postup upozorní.\
*Jak je to teď v aplikaci:* U auta z autopůjčovny aplikace upozorní, že nájemné a palivo jsou výdaje a náhrada za km obvykle nenáleží. U půjčeného auta vyzve k vyplnění vlastníka a přiložení smlouvy o výpůjčce. Tyto údaje ale nejsou povinné a aplikace jejich chybění nehlídá.

**Ú-28 – Austrálie ve vyhlášce 489/2025 Sb.**
Příloha uvádí „Austrálie a Oceánie – ostrovní státy“ (70 USD), ale poznámka vyjmenovává jen ostrovní státy. Austrálie sama jmenovitě uvedena není. Použít pro ni sazbu „Ostatní země neuvedené v příloze“ (35 EUR)?\
*Návrh:* ano, podle doslovného znění. Aplikace na to upozorní a sazbu jde u cesty přepsat ručně.\
*Jak je to teď v aplikaci:* Austrálie se počítá sazbou pro ostatní země (35 EUR) a aplikace na to upozorní. V Souhrnu jde sazbu pro tento stát přepsat ručně.

## Vzorové příklady

Prosíme o 3–5 skutečných vyúčtování (stačí anonymizovaná), ideálně:

1. jednodenní tuzemská cesta s obědem zdarma,
2. vícedenní tuzemská cesta s ubytováním a snídaněmi,
3. zahraniční cesta do jedné země se zálohou v EUR,
4. zahraniční cesta přes více států (autem),
5. cesta soukromým autem s dokladem o tankování.

U každého stačí časy, jídla, výdaje a vámi vypočtené částky. Z nich udělá aplikace automatické testy, které musí vycházet přesně.
