export interface ServerConnection {
  readonly id: string;

  receive(
    raw: unknown
  ): Promise<void>;

  close(): Promise<void>;
}
