// Import Node.js Dependencies
import {
  Readable,
  Writable
} from "node:stream";

// Import Third-party Dependencies
import * as acp from "@agentclientprotocol/sdk";

// Import Internal Dependencies
import { FakeAgent } from "../helpers/FakeAgent.ts";

const agent = new FakeAgent(async(turn) => {
  await turn.say(`Echo: ${turn.text}`);

  return "end_turn";
});
agent.app.connect(acp.ndJsonStream(
  Writable.toWeb(process.stdout),
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
));
