// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import type { RegistrationHandle } from "./types.ts";

export type ConsoleFeature<TContext> = (
  commands: CommandConsole,
  context: TContext
) => RegistrationHandle;

export function registerConsoleFeatures<TContext>(
  commands: CommandConsole,
  features: Iterable<ConsoleFeature<TContext>>,
  context: TContext
): RegistrationHandle {
  const handles: RegistrationHandle[] = [];
  function unregister(): void {
    for (const handle of handles.splice(0).reverse()) {
      handle.unregister();
    }
  }

  try {
    for (const feature of features) {
      handles.push(feature(commands, context));
    }
  }
  catch (error) {
    unregister();

    throw error;
  }

  return {
    unregister
  };
}
