import { Notice } from '../../ui/controls.js';
import { useTrip } from '../context.js';

export function StepPdf() {
  const { issues } = useTrip();
  const errors = issues.filter((i) => i.severity === 'error').length;
  return (
    <>
      <Notice title="Připravujeme">
        Vytvoření cestovního příkazu a vyúčtování v PDF (moderní i konzervativní vzhled) přibude v další verzi aplikace. Vyplněné údaje zůstávají uložené v tomto prohlížeči.
      </Notice>
      {errors > 0 && <Notice tone="danger">Před vytvořením PDF je potřeba opravit chyby v kroku Kontrola ({errors}).</Notice>}
    </>
  );
}
