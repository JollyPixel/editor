export class LockedByPeerError extends Error {
  readonly peer: string;
  readonly target: string;

  constructor(
    peer: string,
    target: string
  ) {
    super(
      `${peer} is editing ${target}. Wait until they are done, or ask them ` +
      "in the chat."
    );
    this.name = "LockedByPeerError";
    this.peer = peer;
    this.target = target;
  }
}
