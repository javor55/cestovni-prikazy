# 07 – Nasazení a provoz

Aplikace má dvě části:

- **webová aplikace** (statické soubory v `apps/web/dist`): formuláře, výpočet, PDF i exporty běží v prohlížeči a data cest se ukládají jen do prohlížeče,
- **API kurzů ČNB** (`/api/kurzy?datum=RRRR-MM-DD`): stáhne kurzovní lístek ČNB a podrží ho v mezipaměti. Dotaz obsahuje jen datum.

Server tedy neukládá žádné údaje o cestách ani doklady a není potřeba databáze ani zálohování.

| Způsob | Kdy | Cena |
|---|---|---|
| [Cloudflare Pages](#1-cloudflare-pages) | testování a veřejný provoz | zdarma (i pro firmy) |
| [Docker na vlastním serveru](#2-docker-na-ubuntu-vm) | vlastní VM s veřejnou doménou | provoz VM |
| [Docker ve firemní síti](#3-firemní-síť) | interní provoz bez internetu zvenku | provoz serveru |

## 1. Cloudflare Pages

Cloudflare po každém sloučení do `main` aplikaci sám sestaví a nasadí. Ke každému pull requestu vytvoří náhledovou adresu, takže změnu jde vyzkoušet ještě před schválením.

### Jednorázové nastavení (asi 10 minut)

1. Založte si účet zdarma na <https://dash.cloudflare.com/sign-up>.
2. V levém menu otevřete **Compute (Workers & Pages)** → **Create** → záložka **Pages** → **Connect to Git** (Import an existing Git repository).
3. Propojte účet GitHub a vyberte repozitář **javor55/cestovni-prikazy**.
4. Nastavení sestavení:

   | Pole | Hodnota |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `pnpm --filter @cp/web build` |
   | Build output directory | `apps/web/dist` |
   | Root directory | *(prázdné – kořen repozitáře)* |

   V části **Environment variables** přidejte `NODE_VERSION` = `22` (stejnou verzi určuje i soubor `.node-version`). Pokud by sestavení hlásilo jinou verzi pnpm, přidejte také `PNPM_VERSION` = `10.28.0`.
5. Klikněte na **Save and Deploy**. Za pár minut poběží aplikace na adrese `https://<název-projektu>.pages.dev`.

Cloudflare najde v repozitáři sám:

- `functions/api/[[path]].ts`: funkce pro `/api/*`, používá stejné API jako server v Dockeru (`apps/server/src/cloudflare.ts`),
- `apps/web/dist/_headers`: bezpečnostní hlavičky včetně CSP, vytvoří se při sestavení ze stejného zdroje jako u serveru (`apps/server/src/headers.ts`),
- `wrangler.toml`: název projektu a výstupní adresář.

Aplikace je SPA. Cloudflare Pages pro neznámé adresy automaticky vrací `index.html`.

### Kontrola po nasazení

- `https://<adresa>/` se otevře a jde založit cestu,
- `https://<adresa>/api/kurzy?datum=2026-10-16` vrátí JSON s kurzy,
- v nástrojích pro vývojáře (záložka Network) má hlavní stránka hlavičku `content-security-policy`.

### Volitelně: přístup jen pro zaměstnance

Aplikace je bez přihlášení, protože nic neukládá na server. Pokud ji chcete skrýt před veřejností, použijte **Cloudflare Access** (Zero Trust, pro malý počet uživatelů zdarma). Nejjednodušší je to s vlastní doménou: Zero Trust → Access → Applications → Add an application → Self-hosted, zadat doménu aplikace a pravidlo „Emails ending in @vase-firma.cz“. Uživatel se pak přihlásí jednorázovým kódem z e-mailu. Náhledové adresy pull requestů lze v nastavení projektu Pages (Settings → General → Access policy) omezit stejně.

### Vlastní doména

Pages → projekt → **Custom domains** → Set up a domain. Pokud doménu spravuje jiný registrátor, Cloudflare ukáže záznam CNAME, který je potřeba přidat.

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
- Aplikace nepotřebuje žádné další služby (databázi, e-mail, úložiště).

## 4. Proměnné prostředí serveru

| Proměnná | Výchozí | Význam |
|---|---|---|
| `PORT` | `8787` | port serveru |
| `STATIC_DIR` | `/app/public` v obrazu | adresář sestavené webové aplikace (bez něj server poskytuje jen API) |
| `RATE_CACHE_DIR` | `/data/kurzy` v obrazu | mezipaměť kurzovních lístků za uplynulé dny |
| `CNB_URL` | adresa ČNB | zdroj kurzovního lístku (textový formát ČNB) |
| `RATE_LIMIT_PER_MINUTE` | `60` | počet dotazů na API za minutu z jedné adresy |
| `TRUST_PROXY` | – | `1` = server je za reverzní proxy, adresa klienta se bere z `X-Forwarded-For` (v `compose.yaml` zapnuto) |
| `DOMAIN`, `CADDYFILE` | – | jen pro Caddy v `compose.yaml` |

## 5. Změna sazeb

Sazby jsou v souboru `packages/rules/data/cz-2026.json` (postup je v [06 – Aktualizace sazeb](06-aktualizace-sazeb.md)). Změnu udělejte přes pull request. Testy ověří, že soubor odpovídá schématu a výpočty sedí. Po sloučení:

- **Cloudflare Pages** nasadí novou verzi automaticky,
- **Docker:** `git pull && sudo docker compose up -d --build`.

Sazby se záměrně nemění za běhu souborem na serveru. Výpočet běží v prohlížeči a každé vytvořené PDF si pamatuje verzi sazeb (`CZ-2026 v1.0.0`). Změna v repozitáři má historii, projde testy a v dokumentu je vidět, podle které verze se počítalo. Jednotlivou sazbu pro konkrétní cestu (např. vyšší stravné u zaměstnavatele) lze zadat přímo v aplikaci.

## 6. Bezpečnost provozu

- **Content Security Policy:** skripty, styly, písma i připojení jen z vlastní domény. `wasm-unsafe-eval` je povolené kvůli sazbě PDF (WebAssembly), `eval` JavaScriptu povolený není. Dále `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `nosniff`, HSTS a `Permissions-Policy` bez kamery, mikrofonu a polohy (fotky dokladů se pořizují přes výběr souboru).
- Stejné hlavičky platí v Dockeru, na Cloudflare i v náhledu, ve kterém běží E2E testy. Každé porušení CSP při testu test shodí.
- **API kurzů:** přijímá jen platné datum, volá pevnou adresu (nelze ho zneužít k dotazům jinam) a má limit počtu požadavků.
- **Service worker** ukládá jen soubory aplikace (aplikace se otevře i bez připojení), nikdy odpovědi API ani data cest.
- **CI:** `pnpm audit` (vysoká a kritická závažnost shodí build), sestavení a kontrola obrazu Docker. Dependabot posílá aktualizace závislostí.
