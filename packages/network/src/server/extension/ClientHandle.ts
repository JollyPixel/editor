export interface SendOptions {
  /**
   * Deflates a binary frame when the transport negotiated compression.
   * Text frames follow the transport's threshold whatever this says.
   * @default false
   */
  compress?: boolean;
}

export interface ClientHandle {
  readonly id: string;

  send(
    data: unknown,
    options?: SendOptions
  ): void;
}
