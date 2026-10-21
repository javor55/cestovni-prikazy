# Otázky pro účetní

Aplikace počítá cestovní náhrady podle zákoníku práce. U následujících bodů potřebujeme potvrdit, jak postupovat. U každé otázky je **návrh výchozího chování**. Stačí odpovědět „souhlasím“, nebo napsat, jak to má být.

Pokud je pravidlo ve vaší firmě dané vnitřním předpisem, napište prosím i to. Aplikace ho umožní nastavit.

Na konci prosíme o **3–5 vzorových vyúčtování** (stačí anonymizovaná), podle kterých ověříme, že aplikace počítá stejně jako vy.

---

## Obecné

**Ú-1 – Sféra zaměstnavatele**
Je zaměstnavatel soukromá firma (podnikatelská sféra), nebo státní/veřejná instituce (platová sféra)? Má aplikace v MVP podporovat obě?
*Návrh:* obě, volba u zaměstnavatele, výchozí podnikatelská.

**Ú-2 – Výše tuzemského stravného**
Platí ve firmě zákonné minimum, nebo vyšší sazby podle vnitřního předpisu? Pokud vyšší, jaké?
*Návrh:* výchozí zákonné minimum, uživatel může zadat sazby podle vnitřního předpisu.

**Ú-3 – Druh pracovního vztahu**
Počítat stejně i pro dohody (DPP, DPČ)?
*Návrh:* ano, stejný výpočet.

**Ú-15 – Lhůty a vnitřní předpis**
Platí zákonná lhůta 10 pracovních dnů pro předložení vyúčtování, nebo jiná podle vnitřního předpisu?
*Návrh:* aplikace zobrazí informativní upozornění s datem podle zákonné lhůty.

**Ú-16 – Požadované doklady**
Které doklady vyžadujete? Stačí účtenka, nebo chcete u plateb soukromou kartou i potvrzení o zaplacení (výpis transakce)? Vyžadujete jízdenky u MHD?
*Návrh:* účetní doklad je vyžadovaný u každého výdaje (jinak varování), potvrzení o zaplacení je nepovinné (varování u soukromé karty).

---

## Čas a stravné

**Ú-9 – Časové pásmo**
Zahraniční cesty: zapisují se časy v českém čase, nebo v místním čase země?
*Návrh:* vše v českém čase. Aplikace umí místní čas přepočítat.

**Ú-5 – Tuzemská a zahraniční část v jednom dni**
Příklad: odjezd z Prahy v 6:00, přechod hranice v 9:00, celý zbytek dne v Německu. Jak se počítá tuzemské stravné za 3 hodiny v ČR v den odjezdu a v den návratu (sčítá se doba v ČR za oba dny, nebo se počítá zvlášť za každý den)?
*Návrh:* podle vašeho postupu, prosíme o jeden konkrétní vzorový příklad.

**Ú-4 – Více států v jednom dni**
Podle sazby kterého státu se počítá zahraniční stravné, pokud zaměstnanec v jednom dni projede více státy (např. ČR → Rakousko → Itálie)?
*Návrh:* stát, ve kterém zaměstnanec v daném dni strávil nejvíce času. Prosíme o potvrzení nebo opravu.

**Ú-17 – Krácení zahraničního stravného za bezplatná jídla**
Jaká procenta krácení používáte v jednotlivých pásmech a z jakého základu (ze základní sazby, nebo z již poměrně snížené částky)?
*Návrh:* z částky pro dané pásmo (např. při 2/3 sazby 45 EUR = 30 EUR krátí snídaně 35 % × 30 = 10,50 EUR). Prosíme o potvrzení na příkladu.

**Ú-18 – Krátké cesty**
Tuzemská cesta kratší než 5 hodin (bez nároku na stravné) a zahraniční cesta s pobytem v zahraničí do 1 hodiny: postupujete podle zákona, nebo poskytujete něco nad rámec?
*Návrh:* podle zákona. Aplikace u krátkých cest jen vypíše, že nárok nevznikl a proč.

**Ú-6 – Snídaně v ceně ubytování**
Snídaně zahrnutá v ceně hotelu: krátíte stravné vždy, nebo jen pokud je na dokladu uvedená samostatně?
*Návrh:* krátit vždy, když je snídaně součástí uhrazeného ubytování. Aplikace se při zadání ubytování zeptá.

**Ú-7 – Letecká doprava**
Za okamžik přechodu hranice při letu považujete odlet z / přílet na letiště v ČR?
*Návrh:* ano.

**Ú-14 – Přerušení cesty**
Pokud zaměstnanec spojí pracovní cestu se soukromým pobytem, jak postupujete (stravné za soukromé dny nenáleží, doprava se proplácí jen v rozsahu pracovní části)?
*Návrh:* soukromé úseky se nezapočítávají. Aplikace je jen vyznačí a výpočet nechá na kontrole účetní.

**Ú-11 – Kapesné**
Poskytuje firma u zahraničních cest kapesné? Pokud ano, kolik procent zahraničního stravného?
*Návrh:* výchozí neposkytuje se.

---

## Měny a kurzy

**Ú-10 – Kurzy a záloha v cizí měně**
1. Jaké datum kurzu ČNB použít pro přepočet výdajů, pokud nebyla záloha (den platby / den nástupu na cestu / den vyúčtování)?
2. Byla-li poskytnuta záloha v cizí měně, přepočítáváte výdaje v této měně kurzem z doby poskytnutí zálohy?
3. Doklad o směně peněz (směnárna, výběr z bankomatu): použijete kurz z dokladu?
4. Platba kartou v cizí měně s potvrzením z bankovnictví: použije se skutečně stržená částka v Kč (takto zadal zadavatel)?
5. Vratka nebo doplatek zálohy v cizí měně: vrací se v cizí měně, nebo v Kč?

*Návrh:* bod 4 ano. Ostatní body nastavíme podle vaší odpovědi.

**Ú-8 – Zaokrouhlování**
Jak zaokrouhlujete?
*Návrh:* stravné za den na celé Kč nahoru, zahraniční stravné na celé jednotky měny nahoru, přepočet kurzem na haléře, celková částka k výplatě na celé Kč.

---

## Vozidlo

**Ú-12 – Soukromé vozidlo a cena pohonných hmot**
1. Používáte cenu z dokladu o tankování, nebo vždy průměrnou cenu z vyhlášky?
2. Při více tankováních: poslední doklad, průměr, nebo jiný postup?
3. Spotřeba z technického průkazu: při třech údajích (město / mimo město / kombinovaná) průměr tří hodnot, nebo kombinovaná?

*Návrh:* cena z dokladu, pokud je přiložen, jinak průměrná cena z vyhlášky. Při více dokladech poslední doklad. Kombinovaná spotřeba, jinak průměr tří hodnot.

**Ú-13 – Elektromobil a plug-in hybrid**
Máte zaměstnance, kteří jezdí soukromým elektromobilem nebo plug-in hybridem? Jak postupujete?
*Návrh:* elektromobil podle průměrné ceny elektřiny z vyhlášky, plug-in hybrid podle volby uživatele (palivo nebo elektřina).

---

## Výsledné dokumenty

**Ú-19 – Co potřebujete v PDF**
Používáte konkrétní tiskopis cestovního příkazu (např. tiskopis SEVT), na který jste zvyklá? Chybí v něm něco, co potřebujete pro zaúčtování (nákladové středisko, zakázka, číslo účtu pro výplatu)?
*Návrh:* vlastní přehledný formát se vším ze zadání. Pokud preferujete známý tiskopis, uděláme konzervativní variantu co nejblíže jemu.

---

## Doplněno při implementaci výpočtu

**Ú-20 – Nižší krácení v podnikatelské sféře**
Zákoník práce v podnikatelské sféře uvádí krácení „až o“ 70 / 35 / 25 %. Krátíte vždy o plné procento, nebo máte ve směrnici nižší?
*Návrh:* vždy plné procento.

**Ú-21 – Zaokrouhlení spotřebovaného paliva**
Náhrada za PHM = km × spotřeba / 100 × cena. Zaokrouhlujete litry před vynásobením cenou?
*Návrh:* nezaokrouhlovat litry, zaokrouhlit až výslednou náhradu na haléře (686 km × 5,6 l = 38,416 l × 38,90 Kč = 1 494,38 Kč).

**Ú-22 – Změna průměrné ceny PHM během roku**
V roce 2026 se průměrná cena nafty změnila od 1. 6. a benzinu 95 od 1. 10. Pokud cesta přes tato data přechází, jakou cenu použít?
*Návrh:* cenu platnou v den začátku cesty. Aplikace na změnu upozorní.

**Ú-23 – Základ pro kapesné**
Počítá se kapesné z výsledného zahraničního stravného za den (po krácení za jídla)?
*Návrh:* ano, z výsledného stravného za den.

**Ú-24 – Hraniční časy pásem**
Cesta trvající přesně 12 hodin patří do pásma 5–12 h a přesně 18 hodin do pásma 12–18 h. Pobyt v zahraničí přesně 1 hodinu už zakládá nárok na 1/3 zahraničního stravného. Souhlasí?
*Návrh:* ano.

## Vzorové příklady

Prosíme o 3–5 skutečných vyúčtování (stačí anonymizovaná), ideálně:

1. jednodenní tuzemská cesta s obědem zdarma,
2. vícedenní tuzemská cesta s ubytováním a snídaněmi,
3. zahraniční cesta do jedné země se zálohou v EUR,
4. zahraniční cesta přes více států (autem),
5. cesta soukromým autem s dokladem o tankování.

U každého stačí časy, jídla, výdaje a vámi vypočtené částky. Z nich udělá aplikace automatické testy, které musí vycházet přesně.
