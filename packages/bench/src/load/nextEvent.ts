export interface MessageSource<TEvent> {
  on(event: "message", listener: (event: TEvent) => void): unknown;
  off(event: "message", listener: (event: TEvent) => void): unknown;
  once(event: "exit", listener: () => void): unknown;
  off(event: "exit", listener: () => void): unknown;
}

export function nextEvent<
  TEvent extends { type: string; },
  TType extends TEvent["type"]
>(
  source: MessageSource<TEvent>,
  type: TType
): Promise<Extract<TEvent, { type: TType; }>> {
  return new Promise((resolve, reject) => {
    function isExpected(
      event: TEvent
    ): event is Extract<TEvent, { type: TType; }> {
      return event.type === type;
    }
    function onMessage(
      event: TEvent
    ): void {
      if (isExpected(event)) {
        source.off("exit", onExit);
        source.off("message", onMessage);
        resolve(event);
      }
    }
    function onExit(): void {
      source.off("message", onMessage);
      reject(new Error(`exited before sending "${type}"`));
    }

    source.on("message", onMessage);
    source.once("exit", onExit);
  });
}
