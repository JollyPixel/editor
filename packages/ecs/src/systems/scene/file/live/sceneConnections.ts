// Import Internal Dependencies
import { SignalEvent } from "../../../../actor/Signal.ts";
import type { ActorComponent } from "../../../../actor/ActorComponent.ts";
import type { Logger } from "../../../Logger.ts";
import type { SceneConnectionFile } from "../SceneFile.ts";
import type { SceneInstanceComponent } from "./SceneInstance.ts";

export interface SceneConnectionSources {
  component(
    id: string
  ): ActorComponent<any> | null;
  components(): Iterable<SceneInstanceComponent>;
}

export function connectSceneSignals(
  sources: SceneConnectionSources,
  logger: Logger
): void {
  for (const { id, component, connections } of sources.components()) {
    for (const connection of connections) {
      const problem = connectSignal(component, connection, sources);
      if (problem !== null) {
        logger.warn(`Signal connection skipped: ${problem}`, {
          component: id,
          signal: connection.signal,
          target: connection.target,
          method: connection.method
        });
      }
    }
  }
}

function connectSignal(
  source: ActorComponent<any>,
  connection: SceneConnectionFile,
  sources: SceneConnectionSources
): string | null {
  const signal: unknown = Reflect.get(source, connection.signal);
  if (!(signal instanceof SignalEvent)) {
    return "signal not found";
  }
  const target = sources.component(connection.target);
  if (target === null) {
    return "target not built";
  }
  const method: unknown = Reflect.get(target, connection.method);
  if (typeof method !== "function") {
    return "method not found";
  }

  target.listen(signal, (...args: unknown[]) => {
    if (!target.pendingForDestruction) {
      Reflect.apply(method, target, args);
    }
  }, { once: connection.once ?? false });

  return null;
}
