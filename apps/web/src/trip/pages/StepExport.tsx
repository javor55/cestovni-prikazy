import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { download } from '../../exports/download.js';
import { slug } from '../../exports/names.js';
import { db, expiresAt } from '../../storage/db.js';
import { Button, Card, H2, Icon, icons, Notice } from '../../ui/controls.js';
import { useTrip } from '../context.js';

export function StepExport() {
  const { trip, mapped, result, docCounts, issues } = useTrip();
  const attachments = useLiveQuery(() => db.attachments.where('tripId').equals(trip.id).toArray(), [trip.id]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const errors = issues.filter((i) => i.severity === 'error').length;

  const run = (what: string, fn: () => Promise<void> | void) => async () => {
    setBusy(what);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(`Soubor se nepodařilo vytvořit: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  };
  const input = { trip, mapped, result, docCounts };
  // Knihovny pro ZIP a XLSX se stahují až při prvním exportu.
  const files = () => import('../../exports/files.js');
  const project = () => import('../../exports/project.js');
  const label = (what: string, text: string) => (busy === what ? 'Připravuji…' : text);

  return (
    <>
      <Card>
        <H2>Pracovní projekt</H2>
        <p className="text-[15px] leading-relaxed text-muted">
          Všechny údaje cesty, originály dokladů, podpis a vytvořená PDF v jednom souboru ZIP. Projekt si uložte – v jiném prohlížeči nebo zařízení ho načtete tlačítkem
          „Načíst pracovní projekt“ na úvodní stránce a můžete pokračovat. Data v tomto prohlížeči se smažou {expiresAt(trip).toLocaleDateString('cs-CZ')}, pokud cestu do té doby
          neotevřete.
        </p>
        <Button
          className="self-start"
          disabled={Boolean(busy)}
          onClick={run('project', async () => {
            const p = await project();
            download(await p.exportProject(trip.id), p.projectFileName(trip), 'application/zip');
          })}
        >
          <Icon d={icons.download} /> {label('project', 'Stáhnout pracovní projekt (ZIP)')}
        </Button>
      </Card>

      <Card>
        <H2>Data pro účetní</H2>
        <p className="text-[15px] leading-relaxed text-muted">
          Tabulky s přehledem cesty, úseky, stravným po dnech, výdaji a náhradou za vozidlo. Částky jsou čísla, měna je v samostatném sloupci. JSON obsahuje úplná data cesty a
          výsledek výpočtu, ale ne soubory dokladů.
        </p>
        {errors > 0 && (
          <Notice tone="warn">
            Cesta má {errors} {errors === 1 ? 'blokující chybu' : errors < 5 ? 'blokující chyby' : 'blokujících chyb'}. Export se vytvoří, ale částky nemusí být úplné – seznam je na
            listu „Kontroly“.
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={Boolean(busy)} onClick={run('xlsx', async () => {
              const f = (await files()).xlsxFile(input);
              download(f.bytes, f.name, f.type);
            })}>
            <Icon d={icons.download} /> {label('xlsx', 'XLSX (Excel)')}
          </Button>
          <Button variant="secondary" disabled={Boolean(busy)} onClick={run('csv', async () => {
              const f = (await files()).csvZipFile(input);
              download(f.bytes, f.name, f.type);
            })}>
            <Icon d={icons.download} /> {label('csv', 'CSV (ZIP)')}
          </Button>
          <Button variant="secondary" disabled={Boolean(busy) || !attachments} onClick={run('json', async () => {
              const f = (await files()).jsonFile(input, attachments ?? []);
              download(f.bytes, f.name, f.type);
            })}>
            <Icon d={icons.download} /> {label('json', 'JSON')}
          </Button>
        </div>
      </Card>

      <Card>
        <H2>Originály dokladů</H2>
        <p className="text-[15px] leading-relaxed text-muted">
          Nahrané soubory beze změny (bez ořezu a zmenšení), roztříděné do složek podle výdajů. Hodí se, pokud účetní chce i původní fotky nebo PDF.
        </p>
        <Button
          variant="secondary"
          className="self-start"
          disabled={Boolean(busy) || !attachments?.length}
          onClick={run('originals', async () => {
            const { bytes } = await (await project()).exportOriginals(trip.id);
            download(bytes, `${slug(trip.number, 'CP')}_Originaly-dokladu.zip`, 'application/zip');
          })}
        >
          <Icon d={icons.download} /> {label('originals', attachments?.length ? `Stáhnout originály (${attachments.length})` : 'Žádné nahrané doklady')}
        </Button>
      </Card>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <p className="text-[13px] text-subtle">Soubory se vytvářejí přímo v prohlížeči a nikam se neodesílají.</p>
    </>
  );
}
