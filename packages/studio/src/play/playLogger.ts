// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";

export function playLoggerOptions(
  warned: (message: string) => void
): Systems.LoggerOptions {
  return {
    level: "warn",
    namespaces: ["*"],
    listener: ({ level, message, meta }) => {
      if (level === "warn") {
        warned(warningMessage(message, meta));
      }
    }
  };
}

function warningMessage(
  message: string,
  meta: Record<string, unknown> | undefined
): string {
  if (meta === undefined) {
    return message;
  }

  const details = Object.entries(meta).map(
    ([key, value]) => `${key}: ${String(value)}`
  );

  return `${message} (${details.join(", ")})`;
}
