export class ComponentSlotError extends Error {
  readonly type: string;
  readonly slot: string;

  constructor(
    type: string,
    slot: string,
    reason: string
  ) {
    super(`The "${type}" component's "${slot}" slot ${reason}.`);
    this.name = "ComponentSlotError";
    this.type = type;
    this.slot = slot;
  }
}
