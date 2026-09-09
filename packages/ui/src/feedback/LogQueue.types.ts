// Import Third-party Dependencies
import type { TemplateResult } from "lit";

export type LogContent = string | TemplateResult;

export interface LogEntry {
  id: string;
  content: LogContent;
  createdAt: number;
}

export type LogListener = (
  entries: readonly LogEntry[]
) => void;

export type LogScheduler = (
  callback: () => void,
  delay: number
) => () => void;

export interface LogQueueOptions {
  max?: number;
  gracePeriod?: number;
  now?: () => number;
  schedule?: LogScheduler;
}
