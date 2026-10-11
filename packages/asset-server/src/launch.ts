// CONSTANTS
export const LAUNCH_ELEMENT_ID = "jolly-launch";

export interface LaunchPayload {
  target: string;
  /**
   * Sent as the WebSocket credential in place of the session cookie.
   */
  credential?: string;
}

export function serializeLaunch(
  payload: LaunchPayload
): string {
  return JSON.stringify(payload)
    .replaceAll("<", "\\u003c");
}

export function launchElement(
  payload: LaunchPayload
): string {
  return `<script type="application/json" id="${LAUNCH_ELEMENT_ID}">` +
    `${serializeLaunch(payload)}</script>`;
}
