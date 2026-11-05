export type RuntimeLogMeta = Record<string, unknown>;

export interface RuntimeLogger {
  debug(
    message: string,
    meta?: RuntimeLogMeta
  ): void;
  isNamespaceEnabled(): boolean;
  step<T>(
    name: string,
    run: () => Promise<T>,
    meta?: RuntimeLogMeta
  ): Promise<T>;
}

export class SilentLogger implements RuntimeLogger {
  debug(): void {
    return;
  }

  isNamespaceEnabled(): boolean {
    return false;
  }

  step<T>(
    _name: string,
    run: () => Promise<T>
  ): Promise<T> {
    return run();
  }
}
