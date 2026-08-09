export class InvalidKeybindingError extends Error {
  constructor(
    binding: string,
    options?: { cause?: unknown; }
  ) {
    super(`Invalid keybinding: "${binding}"`, options);

    this.name = "InvalidKeybindingError";
  }
}
