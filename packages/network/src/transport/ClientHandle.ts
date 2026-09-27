export interface ClientHandle {
  readonly id: string;
  send(
    data: unknown
  ): void;
}
