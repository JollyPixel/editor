// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import type { Lantern } from "@jolly-pixel/lantern";

export interface TourConsoleContext {
  lantern: Lantern;
}

export function tourConsole(
  commands: CommandConsole,
  { lantern }: TourConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("tour", {
    description: "Guided tours of this editor"
  });
  function tourIds(): string[] {
    return Array.from(lantern, (tour) => tour.id);
  }

  namespace.registerCommand("list", {
    description: "List the tours, marking the ones already taken",
    args: [],
    execute: (_args, ctx) => {
      if (lantern.size === 0) {
        ctx.print("No tour is registered");

        return;
      }
      for (const tour of lantern) {
        const seen = lantern.seen.has(tour) ? " (seen)" : "";
        ctx.print(`${tour.id}  ${tour.title}${seen}`);
      }
    }
  });
  namespace.registerCommand("start", {
    description: "Start a tour from its first step",
    args: [
      {
        name: "id",
        type: "string",
        required: true,
        autocomplete: tourIds
      }
    ],
    execute: ({ id }) => {
      const tour = lantern.tour(id);
      commands.close();
      lantern.start(tour);
    }
  });
  namespace.registerCommand("reset", {
    description: "Mark a tour as not taken, or every tour without an id",
    args: [
      {
        name: "id",
        type: "string",
        autocomplete: tourIds
      }
    ],
    execute: ({ id }, ctx) => {
      const tours = id === undefined ? [...lantern] : [lantern.tour(id)];
      lantern.seen.forget(...tours);
      ctx.print(`${tours.length} tour(s) marked as not taken`);
    }
  });

  return namespace;
}
