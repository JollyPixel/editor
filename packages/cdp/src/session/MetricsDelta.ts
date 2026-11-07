export type MetricName =
  | "Timestamp"
  | "AudioHandlers"
  | "Documents"
  | "Frames"
  | "JSEventListeners"
  | "LayoutObjects"
  | "MediaKeySessions"
  | "MediaKeys"
  | "Nodes"
  | "Resources"
  | "ContextLifecycleStateObservers"
  | "V8PerContextDatas"
  | "WorkerGlobalScopes"
  | "UACSSResources"
  | "RTCPeerConnections"
  | "ResourceFetchers"
  | "AdSubframes"
  | "DetachedScriptStates"
  | "ArrayBufferContents"
  | "LayoutCount"
  | "RecalcStyleCount"
  | "LayoutDuration"
  | "RecalcStyleDuration"
  | "DevToolsCommandDuration"
  | "ScriptDuration"
  | "V8CompileDuration"
  | "TaskDuration"
  | "TaskOtherDuration"
  | "ThreadTime"
  | "ProcessTime"
  | "JSHeapUsedSize"
  | "JSHeapTotalSize"
  | "FirstMeaningfulPaint"
  | "DomContentLoaded"
  | "NavigationStart";

export class MetricsDelta {
  readonly #before: ReadonlyMap<string, number>;
  readonly #after: ReadonlyMap<string, number>;

  constructor(
    before: ReadonlyMap<string, number>,
    after: ReadonlyMap<string, number>
  ) {
    this.#before = before;
    this.#after = after;
  }

  change(
    name: MetricName
  ): number {
    return (this.#after.get(name) ?? 0) - (this.#before.get(name) ?? 0);
  }
}
