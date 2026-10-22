# 07 – Nasazení a provoz

Aplikace má dvě části:

- **webová aplikace** (statické soubory v `apps/web/dist`): formuláře, výpočet, PDF i exporty běží v prohlížeči a data cest se ukládají jen do prohlížeče,
- **API kurzů ČNB** (`/api/kurzy?datum=RRRR-MM-DD`): stáhne kurzovní lístek ČNB a podrží ho v mezipaměti. Dotaz obsahuje jen datum.
- **vyhledání zaměstnavatele v ARES** (`/api/ares?ico=…` nebo `?nazev=…`): přepošle dotaz do veřejného registru ARES. Dotaz obsahuje jen zadané IČO nebo název firmy.

Server tedy neukládá žádné údaje o cestách ani doklady a není potřeba databáze ani zálohování.

| Způsob | Kdy | Cena |
|---|---|---|
| [Cloudflare Workers](#1-cloudflare-workers) | testování a veřejný provoz | zdarma (i pro firmy) |
| [Docker na vlastním serveru](#2-docker-na-ubuntu-vm) | vlastní VM s veřejnou doménou | provoz VM |
| [Docker ve firemní síti](#3-firemní-síť) | interní provoz bez internetu zvenku | provoz serveru |

## 1. Cloudflare Workers

Cloudflare po každém sloučení do `main` aplikaci sám sestaví a nasadí. Pro ostatní větve (např. pull requesty) vytvoří náhledovou verzi s vlastní adresou. Workers je hlavní platforma Cloudflare. Starší služba Pages dál funguje, ale nové funkce už dostávají jen Workers.

### Jednorázové nastavení (asi 10 minut)

1. Založte si účet zdarma na <https://dash.cloudflare.com/sign-up>.
2. V levém menu otevřete **Compute (Workers & Pages)** → **Create application** → **Import a repository** (Continue with GitHub).
3. Propojte účet GitHub a vyberte repozitář **javor55/cestovni-prikazy**.
4. Nastavení (*Set up your application*):

   | Pole | Hodnota |
   |---|---|
   | Project name | `cestovni-prikazy` (musí odpovídat `name` ve `wrangler.toml`) |
   | Build command | `pnpm --filter @cp/web build` |
   | Deploy command | `npx wrangler deploy` |
   | Preview command (non-production branches) | `npx wrangler versions upload` |

   V **Advanced settings** nechte kořenový adresář `/`. Verzi Node.js určuje soubor `.node-version` (22). Pokud by sestavení hlásilo starou verzi, přidejte proměnnou sestavení `NODE_VERSION` = `22`. Pokud by hlásilo jinou verzi pnpm, přidejte `PNPM_VERSION` = `10.28.0`.
5. Klikněte na **Deploy**. Za pár minut poběží aplikace na adrese `https://cestovni-prikazy.<váš-účet>.workers.dev`.

Co Cloudflare v repozitáři použije:

- `wrangler.toml`: název, vstupní soubor Workeru a adresář se statickými soubory. Worker se spouští jen pro `/api/*`, ostatní obsluhuje Cloudflare přímo. Neznámé adresy vrací `index.html` (aplikace je SPA).
- `apps/server/src/worker.ts`: stejné API jako server v Dockeru (kurzy ČNB, ARES, limit požadavků, hlavičky),
- `apps/web/dist/_headers`: bezpečnostní hlavičky včetně CSP pro statické soubory. Vytvoří se při sestavení ze stejného zdroje jako u serveru (`apps/server/src/headers.ts`).

### Kontrola po nasazení

- `https://<adresa>/` se otevře a jde založit cestu,
- `https://<adresa>/api/kurzy?datum=2026-10-16` vrátí JSON s kurzy,
- `https://<adresa>/api/ares?ico=00006947` vrátí Ministerstvo financí,
- v nástrojích pro vývojáře (záložka Network) má hlavní stránka hlavičku `content-security-policy`.

### Volitelně: přístup jen pro zaměstnance

Aplikace je bez přihlášení, protože nic neukládá na server. Pokud ji chcete skrýt před veřejností, použijte **Cloudflare Access** (Zero Trust, pro malý počet uživatelů zdarma). V nastavení Workeru (Settings → Domains & Routes) lze u adresy `workers.dev` i u náhledových adres zapnout Cloudflare Access. Pro vlastní doménu: Zero Trust → Access → Applications → Add an application → Self-hosted, zadat doménu aplikace a pravidlo „Emails ending in @vase-firma.cz“. Uživatel se pak přihlásí jednorázovým kódem z e-mailu.

### Vlastní doména

Worker → **Settings** → **Domains & Routes** → Add → Custom domain. Doména musí být spravovaná v Cloudflare (DNS zóna v účtu).

### Lokální vyzkoušení

```bash
pnpm --filter @cp/web build
npx wrangler dev            # simulace Cloudflare na http://localhost:8787
```

## 2. Docker na Ubuntu VM

Potřebujete VM s veřejnou IP adresou, doménu (záznam **A** mířící na IP adresu VM) a otevřené porty **80** a **443**.

```bash
# 1) Docker (oficiální instalační skript)
curl -fsSL https://get.docker.com | sudo sh

# 2) Aplikace
git clone https://github.com/javor55/cestovni-prikazy.git
cd cestovni-prikazy
cp deploy/env.example .env
nano .env                      # DOMAIN=cestovni-prikazy.vase-domena.cz

# 3) Spuštění (sestavení obrazu trvá pár minut)
sudo docker compose up -d --build
sudo docker compose ps         # app: healthy, caddy: running
```

Caddy sám získá certifikát Let's Encrypt a obnovuje ho. HTTP přesměruje na HTTPS.

| Úkol | Příkaz |
|---|---|
| Aktualizace na novou verzi | `git pull && sudo docker compose up -d --build` |
| Logy | `sudo docker compose logs -f app` |
| Zastavení | `sudo docker compose down` |
| Jen aplikace bez Caddy (např. za jinou proxy) | `docker build -t cestovni-prikazy . && docker run -d -p 8787:8787 -v cp-data:/data cestovni-prikazy` |

Kontejner aplikace běží pod neprivilegovaným uživatelem. V `compose.yaml` má navíc souborový systém jen pro čtení a nemá žádné linuxové capabilities. Zapisuje jen mezipaměť kurzů do svazku `/data`. Stav hlásí na `/zdravi` (Docker healthcheck).

## 3. Firemní síť

Postup je stejný jako v bodě 2, s těmito rozdíly:

- **HTTPS je nutné i v interní síti.** Prohlížeč přes čisté HTTP nepovolí šifrovací funkce, které aplikace používá (kontrolní součty dokladů, náhodná id). Výjimkou je jen `localhost`. V `.env` nastavte `CADDYFILE=Caddyfile.intranet` a interní název serveru do `DOMAIN`. Certifikát pak vydá interní certifikační autorita Caddy (její kořenový certifikát musí IT nainstalovat do zařízení), nebo použijte firemní certifikát. Návod je přímo v `deploy/Caddyfile.intranet`.
- **Kurzy ČNB:** server potřebuje přístup na `www.cnb.cz`. Pokud ho nemá, aplikace při výpadku nabídne ruční zadání kurzu. Přes proměnnou `CNB_URL` lze nastavit interní zrcadlo nebo proxy, které vrací stejný textový formát.
- **ARES:** server potřebuje přístup na `ares.gov.cz`. Bez něj vyhledávání nahlásí, že ARES neodpovídá, a údaje zaměstnavatele se vyplní ručně. `ARES_URL=off` vyhledávání vypne úplně.
- Aplikace nepotřebuje žádné další služby (databázi, e-mail, úložiště).

## 4. Proměnné prostředí serveru

| Proměnná | Výchozí | Význam |
|---|---|---|
| `PORT` | `8787` | port serveru |
| `STATIC_DIR` | `/app/public` v obrazu | adresář sestavené webové aplikace (bez něj server poskytuje jen API) |
| `RATE_CACHE_DIR` | `/data/kurzy` v obrazu | mezipaměť kurzovních lístků za uplynulé dny |
| `CNB_URL` | adresa ČNB | zdroj kurzovního lístku (textový formát ČNB) |
| `ARES_URL` | adresa ARES | REST API ARES (`…/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty`), `off` = vyhledávání vypnuté |
| `RATE_LIMIT_PER_MINUTE` | `60` | počet dotazů na API za minutu z jedné adresy |
| `TRUST_PROXY` | – | `1` = server je za reverzní proxy, adresa klienta se bere z `X-Forwarded-For` (v `compose.yaml` zapnuto) |
| `DOMAIN`, `CADDYFILE` | – | jen pro Caddy v `compose.yaml` |

## 5. Změna sazeb

Sazby jsou v souboru `packages/rules/data/cz-2026.json` (postup je v [06 – Aktualizace sazeb](06-aktualizace-sazeb.md)). Změnu udělejte přes pull request. Testy ověří, že soubor odpovídá schématu a výpočty sedí. Po sloučení:

- **Cloudflare** nasadí novou verzi automaticky,
- **Docker:** `git pull && sudo docker compose up -d --build`.

Sazby se záměrně nemění za běhu souborem na serveru. Výpočet běží v prohlížeči a každé vytvořené PDF si pamatuje verzi sazeb (např. `CZ-2026 v1.2.0`). Změna v repozitáři má historii, projde testy a v dokumentu je vidět, podle které verze se počítalo. Jednotlivou sazbu pro konkrétní cestu (např. vyšší stravné u zaměstnavatele) lze zadat přímo v aplikaci.

## 6. Bezpečnost provozu

- **Content Security Policy:** skripty, styly, písma i připojení jen z vlastní domény. `wasm-unsafe-eval` je povolené kvůli sazbě PDF (WebAssembly), `eval` JavaScriptu povolený není. Dále `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `nosniff`, HSTS a `Permissions-Policy` bez kamery, mikrofonu a polohy (fotky dokladů se pořizují přes výběr souboru).
- Stejné hlavičky platí v Dockeru, na Cloudflare i v náhledu, ve kterém běží E2E testy. Každé porušení CSP při testu test shodí.
- **API kurzů:** přijímá jen platné datum, volá pevnou adresu (nelze ho zneužít k dotazům jinam) a má limit počtu požadavků.
- **Service worker** ukládá jen soubory aplikace (aplikace se otevře i bez připojení), nikdy odpovědi API ani data cest.
- **CI:** `pnpm audit` (vysoká a kritická závažnost shodí build), sestavení a kontrola obrazu Docker. Dependabot posílá aktualizace závislostí.
