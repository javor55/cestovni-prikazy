export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  /** Stabilní kód pro UI a testy, např. „SEGMENT_ARRIVAL_BEFORE_DEPARTURE“. */
  code: string;
  /** Srozumitelná česká zpráva včetně toho, jak problém opravit. */
  message: string;
  /** Odkaz na místo v datech, např. { segmentId } nebo { expenseId }. */
  ref?: Record<string, string>;
}

export class IssueList {
  readonly items: Issue[] = [];

  error(code: string, message: string, ref?: Record<string, string>) {
    this.items.push({ severity: 'error', code, message, ...(ref && { ref }) });
  }
  warning(code: string, message: string, ref?: Record<string, string>) {
    this.items.push({ severity: 'warning', code, message, ...(ref && { ref }) });
  }
  info(code: string, message: string, ref?: Record<string, string>) {
    this.items.push({ severity: 'info', code, message, ...(ref && { ref }) });
  }
  get hasErrors(): boolean {
    return this.items.some((i) => i.severity === 'error');
  }
}
