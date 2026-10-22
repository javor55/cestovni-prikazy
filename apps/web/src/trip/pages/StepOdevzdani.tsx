import { CompletePdf } from './CompletePdf.js';
import { Exports } from './Exports.js';

/** Odevzdání: kompletní dokumentace v PDF a exporty (tabulky, projekt, originály) na jednom místě. */
export function StepOdevzdani() {
  return (
    <>
      <CompletePdf />
      <Exports />
    </>
  );
}
