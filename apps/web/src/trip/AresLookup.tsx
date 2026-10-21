import { useState, type FormEvent } from 'react';
import { formatDay } from '../model/format.js';
import { AresError, searchAres, type AresResult, type AresSubject } from '../registry/ares.js';
import { Button, TextField } from '../ui/controls.js';

/** Vyhledání zaměstnavatele v ARES podle IČO nebo názvu; vybraný subjekt předá k doplnění formuláře. */
export function AresLookup({ onPick }: { onPick: (s: AresSubject) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AresResult>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      const r = await searchAres(text);
      // Jediný výsledek hledání podle IČO se rovnou doplní.
      if (/^[\d\s]+$/.test(text.trim()) && r.subjects.length === 1) {
        pick(r.subjects[0]!);
      } else setResult(r);
    } catch (err) {
      setError(err instanceof AresError ? err.message : 'ARES se nepodařilo zavolat. Údaje vyplňte ručně.');
    } finally {
      setBusy(false);
    }
  };

  const pick = (s: AresSubject) => {
    onPick(s);
    setResult(undefined);
    setText('');
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <form className="flex flex-wrap items-start gap-2" onSubmit={(e) => void submit(e)} role="search" aria-label="Vyhledat zaměstnavatele v ARES">
        <TextField
          className="min-w-0 flex-1 basis-56"
          label="Vyhledat v ARES"
          value={text}
          onChange={setText}
          placeholder="IČO nebo název firmy"
          error={error || undefined}
        />
        {/* Odsazení o výšku popisku – tlačítko je v jedné řadě s polem i při zobrazené chybě. */}
        <Button type="submit" variant="secondary" className="sm:mt-[1.625rem]" disabled={busy || !text.trim()}>
          {busy ? 'Hledám…' : 'Vyhledat'}
        </Button>
      </form>
      <p className="text-[13px] leading-snug text-subtle">Doplní název, IČO a sídlo z veřejného registru ekonomických subjektů. Odesílá se jen to, co do pole napíšete.</p>
      {result && (
        <div className="flex flex-col gap-2" role="status">
          {result.subjects.length === 0 ? (
            <p className="text-[15px]">Nic nenalezeno. Zkuste jiný tvar názvu, nebo zadejte IČO.</p>
          ) : (
            <>
              <p className="text-[13px] text-subtle">
                {result.total > result.subjects.length ? `Prvních ${result.subjects.length} z ${result.total} – případně upřesněte název.` : 'Vyberte zaměstnavatele:'}
              </p>
              <ul className="flex flex-col gap-2">
                {result.subjects.map((s) => (
                  <li key={s.ico}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start rounded-lg border border-line px-3 py-2 text-left hover:border-accent focus-visible:border-accent"
                      onClick={() => pick(s)}
                    >
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-[13px] text-muted">
                        IČO {s.ico}
                        {s.seat && ` · ${s.seat}`}
                      </span>
                      {s.dissolved && <span className="text-[13px] font-semibold text-danger">Zaniklo {formatDay(s.dissolved)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
