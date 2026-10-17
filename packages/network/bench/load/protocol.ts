export const SCENARIOS = ["presence", "command", "churn"] as const;

export type Scenario = typeof SCENARIOS[number];

export interface LoadServerConfig {
  rooms: number;
  variants: number;
  snapshotBytes: number;
  compression: boolean;
  rights: boolean;
}

export interface Workload {
  scenario: Scenario;
  rooms: number;
  variants: number;
}

export function roomName(
  index: number
): string {
  return `room-${index}`;
}
