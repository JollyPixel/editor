export function errorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

export class UngatedExtensionError extends Error {}
export class UnknownDefaultRoleError extends Error {}
