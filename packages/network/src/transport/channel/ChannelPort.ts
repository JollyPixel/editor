export type ChannelPortListener = (event: { data: unknown; }) => void;

export interface ChannelPort {
  postMessage(
    message: unknown
  ): void;

  addEventListener(
    type: "message",
    listener: ChannelPortListener
  ): void;

  removeEventListener(
    type: "message",
    listener: ChannelPortListener
  ): void;

  start?(): void;

  close?(): void;
}

export type ChannelSocketPortFactory = (
  socket: string
) => ChannelPort;
