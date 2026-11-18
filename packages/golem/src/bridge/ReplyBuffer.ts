// Import Third-party Dependencies
import { AGENT_CHAT_TEXT_MAX_LENGTH } from "@jolly-pixel/server";

export class ReplyBuffer {
  #text = "";

  append(
    text: string
  ): void {
    this.#text += text;
  }

  take(): string[] {
    const messages: string[] = [];
    let rest = this.#text.trim();
    this.#text = "";
    while (rest.length > AGENT_CHAT_TEXT_MAX_LENGTH) {
      const newline = rest.lastIndexOf("\n", AGENT_CHAT_TEXT_MAX_LENGTH);
      const cut = newline > 0 ? newline : AGENT_CHAT_TEXT_MAX_LENGTH;
      messages.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    if (rest.length > 0) {
      messages.push(rest);
    }

    return messages;
  }
}
