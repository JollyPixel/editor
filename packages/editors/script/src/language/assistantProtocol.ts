// Import Third-party Dependencies
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";
import type {
  ScriptCompletion,
  ScriptQuickInfo
} from "@jolly-pixel/scripting/language";

export interface AssistantAnswers {
  diagnostics: ScriptDiagnostic[];
  completions: ScriptCompletion[];
  quickInfo: ScriptQuickInfo | null;
}

export type AssistantQuestion = keyof AssistantAnswers;

export type AssistantMessage =
  | {
    type: "open";
    path: string;
  }
  | {
    type: AssistantQuestion;
    id: number;
    text: string;
    offset: number;
  };

export type AssistantReply =
  | {
    id: number;
    answer: AssistantAnswers[AssistantQuestion];
  }
  | {
    id: number;
    error: string;
  };
