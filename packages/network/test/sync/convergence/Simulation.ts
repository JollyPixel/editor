// Import Internal Dependencies
import { Prng } from "./Prng.ts";
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
  seed: number;
  scenario: ToyScenario;
  clients?: number;
  edits?: number;
  opaque?: readonly ToyBody["action"][];
  versioned?: boolean;
}

export interface SimulationResult {
  server: ToySnapshot;
  views: ToySnapshot[];
  converged: boolean;
}

type Step = () => void;

export function simulate(
  options: SimulationOptions
): SimulationResult {
  const {
    seed,
    scenario,
    clients: clientCount = 3,
    edits = 8,
    opaque = [],
    versioned = true
  } = options;
  const prng = new Prng(seed);
  const server = new ToyServer(versioned);
  const clients = Array.from({ length: clientCount }, (_, index) => {
    const client = new ToyClient(
      String.fromCharCode(65 + index),
      prng.int(kMaxSkew * 2 + 1) - kMaxSkew,
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
          client.edit(prng, scenario, server.now);
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
    prng.pick(steps)();
  }

  const expected = JSON.stringify(server.state.toJSON());
  const views = clients.map((client) => client.view.toJSON());

  return {
    server: server.state.toJSON(),
    views,
    converged: views.every((view) => JSON.stringify(view) === expected)
  };
}

export function divergentSeeds(
  options: Omit<SimulationOptions, "seed">,
  seeds: number
): number[] {
  const failures: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    if (!simulate({ ...options, seed }).converged) {
      failures.push(seed);
    }
  }

  return failures;
}
