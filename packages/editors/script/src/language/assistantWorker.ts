// Import Third-party Dependencies
import { ScriptLanguageService } from "@jolly-pixel/scripting/language";
import files from "@jolly-pixel/scripting/types";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  AssistantAnswers,
  AssistantMessage,
  AssistantQuestion,
  AssistantReply
} from "./assistantProtocol.ts";

type AssistantQuestionMessage = Exclude<AssistantMessage, { type: "open"; }>;

// CONSTANTS
const kScope = self as unknown as Worker;

let service: ScriptLanguageService | null = null;

kScope.addEventListener("message", (event: MessageEvent<AssistantMessage>) => {
  const message = event.data;
  if (message.type === "open") {
    service?.dispose();
    service = new ScriptLanguageService(files, message.path);

    return;
  }

  kScope.postMessage(reply(message));
});

function reply(
  message: AssistantQuestionMessage
): AssistantReply {
  const { id } = message;
  if (service === null) {
    return {
      id,
      error: "The language service is not open."
    };
  }

  try {
    return {
      id,
      answer: answer(service, message)
    };
  }
  catch (error) {
    return {
      id,
      error: errorMessage(error)
    };
  }
}

function answer(
  open: ScriptLanguageService,
  message: AssistantQuestionMessage
): AssistantAnswers[AssistantQuestion] {
  const { text, offset } = message;
  switch (message.type) {
    case "diagnostics":
      return open.diagnostics(text);
    case "completions":
      return open.completions(text, offset);
    case "quickInfo":
      return open.quickInfo(text, offset);
  }
}
