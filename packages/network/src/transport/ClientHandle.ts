export interface ClientHandle {
  readonly id: string;

  send(
    data: unknown
  ): void;

  sendSerialized?(
    json: string
  ): void;

  close?(
    code: number,
    reason: string
  ): void;
}
