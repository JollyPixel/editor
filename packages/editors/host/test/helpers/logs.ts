// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

export interface CapturedLogs {
  logger: Systems.Logger;
  lines: string[];
  metas: Array<Record<string, unknown> | undefined>;
}

export function captureLogs(
  namespaces: string[] = ["*"]
): CapturedLogs {
  const lines: string[] = [];
  const metas: CapturedLogs["metas"] = [];

  function record(
    line: string,
    meta?: Record<string, unknown>
  ): void {
    lines.push(line);
    metas.push(meta);
  }

  return {
    lines,
    metas,
    logger: new Systems.Logger({
      level: "debug",
      namespaces,
      adapter: {
        log: record,
        warn: record,
        error: record
      }
    })
  };
}
