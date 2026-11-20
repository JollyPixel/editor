// Import Third-party Dependencies
import type { SceneConnectionView } from "@jolly-pixel/asset.scene/client";
import type {
  ComponentSignals,
  DeclaredMember
} from "@jolly-pixel/editor.host/scene";
import type { JollyOption } from "@jolly-pixel/ui";

export interface SignalComponent {
  id: string;
  actorName: string;
  label: string;
  /**
   * `null` while the component's declarations are loading.
   */
  signals: ComponentSignals | null;
}

export type SignalComponentResolver = (
  id: string
) => SignalComponent | null;

export function signature(
  member: DeclaredMember
): string {
  const params = member.params.map(
    ({ name, type }) => (type === "" ? name : `${name}: ${type}`)
  );

  return `${member.key}(${params.join(", ")})`;
}

export class SignalTargets {
  #resolve: SignalComponentResolver;
  #resolved = new Map<string, SignalComponent | null>();

  constructor(
    resolve: SignalComponentResolver
  ) {
    this.#resolve = resolve;
  }

  component(
    id: string
  ): SignalComponent | null {
    if (!this.#resolved.has(id)) {
      this.#resolved.set(id, this.#resolve(id));
    }

    return this.#resolved.get(id) ?? null;
  }

  options(
    ids: Iterable<string>
  ): JollyOption<string>[] {
    const options: JollyOption<string>[] = [];
    for (const id of ids) {
      const component = this.component(id);
      if (component !== null && (component.signals?.methods.length ?? 0) > 0) {
        options.push({
          value: id,
          label: component.label,
          group: component.actorName
        });
      }
    }

    return options;
  }

  methodOptions(
    targetId: string
  ): JollyOption<string>[] {
    const methods = this.component(targetId)?.signals?.methods ?? [];

    return methods.map((method) => {
      return {
        value: method.key,
        label: signature(method)
      };
    });
  }

  describe(
    connection: SceneConnectionView
  ): string {
    const target = this.component(connection.target);
    const owner = target === null ?
      "Missing component" :
      `${target.actorName} › ${target.label}`;

    return `${owner}.${connection.method}()`;
  }

  problem(
    connection: SceneConnectionView,
    signal: DeclaredMember | undefined
  ): string | null {
    const target = this.component(connection.target);
    if (target === null) {
      return "The target component no longer exists.";
    }
    if (target.signals === null) {
      return null;
    }

    const method = target.signals.methods.find(
      ({ key }) => key === connection.method
    );
    if (method === undefined) {
      return `${target.label} has no method ${connection.method}.`;
    }
    if (signal !== undefined && method.params.length > signal.params.length) {
      return `${connection.method} takes ${method.params.length} arguments, ` +
        `the signal sends ${signal.params.length}.`;
    }

    return null;
  }
}
