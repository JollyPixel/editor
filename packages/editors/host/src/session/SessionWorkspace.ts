export interface SessionWorkspace {
  readonly persistent: boolean;

  reset(): Promise<void>;
}
