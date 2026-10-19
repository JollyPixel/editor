// Import Internal Dependencies
import type {
  AuditCategory,
  AuditQuery
} from "./routes.ts";

export interface AuditFiltersData {
  actor?: string;
  asset?: string;
  category?: AuditCategory;
  /**
   * First day included, as `YYYY-MM-DD` in local time.
   */
  from?: string;
  /**
   * Last day included, as `YYYY-MM-DD` in local time.
   */
  to?: string;
}

// CONSTANTS
const kDayPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export class AuditFilters {
  static readonly NONE = new AuditFilters({});

  readonly data: Readonly<AuditFiltersData>;

  constructor(
    data: AuditFiltersData
  ) {
    this.data = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== "")
    );
  }

  with(
    patch: AuditFiltersData
  ): AuditFilters {
    return new AuditFilters({
      ...this.data,
      ...patch
    });
  }

  toQuery(
    cursor?: string
  ): AuditQuery {
    const { actor, asset, category, from, to } = this.data;
    const start = from === undefined ? undefined : dayStart(from);
    const end = to === undefined ? undefined : dayStart(to);

    return {
      cursor,
      actor,
      asset,
      category,
      from: start,
      to: end === undefined ? undefined : end + dayLength(end) - 1
    };
  }
}

function dayStart(
  day: string
): number | undefined {
  const match = kDayPattern.exec(day);
  if (match === null) {
    return undefined;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ).getTime();
}

function dayLength(
  start: number
): number {
  const next = new Date(start);
  next.setDate(next.getDate() + 1);

  return next.getTime() - start;
}
