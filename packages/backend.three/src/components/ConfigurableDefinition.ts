// Import Third-party Dependencies
import type {
  Actor,
  ActorComponent,
  ComponentClass,
  Systems
} from "@jolly-pixel/ecs";

export interface ConfigurableComponent<TData> extends ActorComponent<any> {
  configure(
    data: TData
  ): unknown;
}

export abstract class ConfigurableDefinition<
  TData,
  TComponent extends ConfigurableComponent<TData>,
  TAssets extends Systems.ComponentAssetValues = Systems.ComponentAssetValues
> implements Systems.ComponentDefinition<TData, TComponent, TAssets> {
  abstract readonly type: string;
  protected abstract readonly component: ComponentClass<TComponent>;

  abstract parse(
    data: Readonly<Systems.JSONObject>
  ): TData;

  abstract create(
    actor: Actor<any>,
    data: TData,
    context: Systems.ComponentContext<TAssets>
  ): TComponent | null;

  apply(
    component: TComponent,
    data: TData
  ): void {
    component.configure(data);
  }

  owns(
    component: ActorComponent<any>
  ): component is TComponent {
    return component instanceof this.component;
  }
}
