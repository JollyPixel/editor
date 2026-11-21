// Import Third-party Dependencies
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";
import type {
  ScriptCompletion,
  ScriptQuickInfo
} from "@jolly-pixel/scripting/language";

export interface LanguageAnswers {
  diagnostics: ScriptDiagnostic[];
  completions: ScriptCompletion[];
  quickInfo: ScriptQuickInfo | null;
}

export type LanguageQuestion = keyof LanguageAnswers;

export interface LanguageQuestions {
  diagnostics(text: string): Promise<LanguageAnswers["diagnostics"]>;
  completions(text: string, offset: number): Promise<LanguageAnswers["completions"]>;
  quickInfo(text: string, offset: number): Promise<LanguageAnswers["quickInfo"]>;
}

export type LanguageMessage =
  | {
    type: "open";
    path: string;
  }
  | {
    type: LanguageQuestion;
    id: number;
    text: string;
    offset: number;
  };

export type LanguageReply =
  | {
    id: number;
    answer: LanguageAnswers[LanguageQuestion];
  }
  | {
    id: number;
    error: string;
  };
