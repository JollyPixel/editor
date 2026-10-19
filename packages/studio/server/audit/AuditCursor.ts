// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { AuditSourceName } from "./AuditEntry.ts";

// CONSTANTS
const kPositionsSchema = z.object({
  events: z.number().optional(),
  audit: z.number().optional(),
  tags: z.string().optional()
});

export type AuditPositions = Partial<Record<AuditSourceName, number | string>>;

export class AuditCursor {
  static decode(
    value: string | undefined
  ): AuditCursor {
    if (value === undefined || value === "") {
      return new AuditCursor({});
    }

    try {
      return AuditCursor.from(
        JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
      );
    }
    catch {
      return new AuditCursor({});
    }
  }

  static from(
    positions: unknown
  ): AuditCursor {
    const parsed = kPositionsSchema.safeParse(positions);

    return new AuditCursor(parsed.success ? parsed.data : {});
  }

  readonly events: number | undefined;
  readonly audit: number | undefined;
  readonly tags: string | undefined;

  constructor(
    positions: z.infer<typeof kPositionsSchema>
  ) {
    this.events = positions.events;
    this.audit = positions.audit;
    this.tags = positions.tags;
  }

  toJSON(): AuditPositions {
    return {
      events: this.events,
      audit: this.audit,
      tags: this.tags
    };
  }

  encode(): string {
    return Buffer.from(JSON.stringify(this)).toString("base64url");
  }
}
