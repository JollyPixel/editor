export class TargetInUseError extends Error {
  readonly target: string;
  readonly dependents: readonly string[];

  constructor(
    target: string,
    dependents: readonly string[]
  ) {
    const named = dependents.map((dependent) => `"${dependent}"`).join(", ");
    super(`"${target}" cannot be deleted while ${named} use it.`);
    this.name = "TargetInUseError";
    this.target = target;
    this.dependents = dependents;
  }
}
