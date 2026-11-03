export class Claim {
  static earliest(
    claims: Iterable<Claim>
  ): Claim | null {
    let earliest: Claim | null = null;
    for (const claim of claims) {
      if (earliest === null || claim.precedes(earliest)) {
        earliest = claim;
      }
    }

    return earliest;
  }

  readonly clientId: string;
  readonly since: number;

  constructor(
    clientId: string,
    since: number
  ) {
    this.clientId = clientId;
    this.since = since;
  }

  precedes(
    other: Claim
  ): boolean {
    return this.since === other.since ?
      this.clientId < other.clientId :
      this.since < other.since;
  }
}
