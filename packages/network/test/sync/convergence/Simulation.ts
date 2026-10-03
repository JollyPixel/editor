// Import Internal Dependencies
import type { Choices } from "./Choices.ts";
import {
  ToyClient,
  type ToyScenario
} from "./ToyClient.ts";
import type {
  ToyBody,
  ToyCommand,
  ToySnapshot
} from "./ToyDocument.ts";
import { ToyServer } from "./ToyServer.ts";

// CONSTANTS
const kMaxSkew = 3;

export interface SimulationOptions {
  choices: Choices;
  scenario: ToyScenario;
  clients?: number;
  edits?: number;
  opaque?: readonly ToyBody["action"][];
  versioned?: boolean;
}

export interface SimulationResult {
  server: ToySnapshot;
  views: ToySnapshot[];
}

type Step = () => void;

export function simulate(
  options: SimulationOptions
): SimulationResult {
  const {
    choices,
    scenario,
    clients: clientCount = 3,
    edits = 8,
    opaque = [],
    versioned = true
  } = options;
  const server = new ToyServer(versioned);
  const clients = Array.from({ length: clientCount }, (_, index) => {
    const client = new ToyClient(
      String.fromCharCode(65 + index),
      choices.int(kMaxSkew * 2 + 1) - kMaxSkew,
      opaque
    );
    server.connect(client.id, (message) => client.inbox.push(message));

    return client;
  });
  const remaining = clients.map(() => edits);

  for (;;) {
    const steps: Step[] = [];
    clients.forEach((client, index) => {
      if (remaining[index] > 0) {
        steps.push(() => {
          remaining[index]--;
          client.edit(choices, scenario, server.now);
        });
      }
      if (client.outbound > 0) {
        steps.push(() => {
          const envelope = client.takeOutbound();
          if (envelope.kind === "resync") {
            server.resync(client.id);
          }
          else if (envelope.kind === "message") {
            server.receive(client.id, envelope.payload as ToyCommand);
          }
        });
      }
      if (client.inbox.length > 0) {
        steps.push(() => client.deliverInbound());
      }
    });
    if (steps.length === 0) {
      break;
    }

    server.now++;
    choices.pick(steps)();
  }

  return {
    server: server.state.toJSON(),
    views: clients.map((client) => client.view.toJSON())
  };
}
