// Import Third-party Dependencies
import { ScriptLanguageService } from "@jolly-pixel/scripting/language";
import files from "@jolly-pixel/scripting/types";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  LanguageAnswers,
  LanguageMessage,
  LanguageQuestion,
  LanguageReply
} from "./languageProtocol.ts";

type LanguageQuestionMessage = Exclude<LanguageMessage, { type: "open"; }>;

let service: ScriptLanguageService | null = null;

self.addEventListener("message", (event: MessageEvent<LanguageMessage>) => {
  const message = event.data;
  if (message.type === "open") {
    service?.dispose();
    service = new ScriptLanguageService(files, message.path);

    return;
  }

  self.postMessage(reply(message));
});

function reply(
  message: LanguageQuestionMessage
): LanguageReply {
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
  languageService: ScriptLanguageService,
  message: LanguageQuestionMessage
): LanguageAnswers[LanguageQuestion] {
  const { text, offset } = message;
  switch (message.type) {
    case "diagnostics":
      return languageService.diagnostics(text);
    case "completions":
      return languageService.completions(text, offset);
    case "quickInfo":
      return languageService.quickInfo(text, offset);
  }
}
