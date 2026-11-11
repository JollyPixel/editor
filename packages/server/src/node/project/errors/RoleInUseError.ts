export class RoleInUseError extends Error {
  readonly role: string;

  constructor(
    role: string,
    reason: string
  ) {
    super(`the "${role}" role cannot be deleted: ${reason}`);
    this.name = "RoleInUseError";
    this.role = role;
  }
}
