export function upcastSceneCommand(
  stored: unknown
): unknown {
  if (!isInlineEnvironmentChange(stored)) {
    return stored;
  }

  return {
    ...stored,
    environment: null
  };
}

function isInlineEnvironmentChange(
  stored: unknown
): stored is { action: string; environment: object; } {
  return typeof stored === "object" &&
    stored !== null &&
    "action" in stored &&
    stored.action === "environment-changed" &&
    "environment" in stored &&
    typeof stored.environment === "object" &&
    stored.environment !== null &&
    !("id" in stored.environment);
}
