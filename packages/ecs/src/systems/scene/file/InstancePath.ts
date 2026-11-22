// CONSTANTS
const kSeparator = "/";

export class InstancePath {
  static join(
    instanceId: string,
    path: string
  ): string {
    return `${instanceId}${kSeparator}${path}`;
  }

  static parse(
    id: string
  ): InstancePath | null {
    const separator = id.indexOf(kSeparator);

    return separator === -1 ?
      null :
      new InstancePath(id.slice(0, separator), id.slice(separator + 1));
  }

  readonly instanceId: string;
  readonly path: string;

  constructor(
    instanceId: string,
    path: string
  ) {
    this.instanceId = instanceId;
    this.path = path;
  }

  get ownerId(): string {
    const last = this.path.lastIndexOf(kSeparator);

    return last === -1 ?
      this.instanceId :
      InstancePath.join(this.instanceId, this.path.slice(0, last));
  }
}
