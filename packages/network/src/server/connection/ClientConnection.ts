export interface ClientConnection {
  readonly id: string;

  sendSerialized(
    json: string
  ): void;

  close(
    code: number,
    reason: string
  ): void;
}
