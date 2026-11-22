export type RuntimeLogMeta = Record<string, unknown>;

export interface RuntimeLogger {
  warn(
    message: string,
    meta?: RuntimeLogMeta
  ): void;
  step<T>(
    name: string,
    run: () => Promise<T>,
    meta?: RuntimeLogMeta
  ): Promise<T>;
}

export class SilentLogger implements RuntimeLogger {
  warn(): void {
    return;
  }

  step<T>(
    _name: string,
    run: () => Promise<T>
  ): Promise<T> {
    return run();
  }
}
