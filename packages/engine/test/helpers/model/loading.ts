// Import Third-party Dependencies
import { Window } from "happy-dom";
import * as THREE from "three/webgpu";

class FakeProgressEvent extends Event {
  readonly lengthComputable = false;
  readonly loaded = 0;
  readonly total = 0;
}

export async function withProgressEvents<T>(
  run: () => Promise<T>
): Promise<T> {
  const previous = globalThis.ProgressEvent;
  globalThis.ProgressEvent = FakeProgressEvent;
  try {
    return await run();
  }
  finally {
    globalThis.ProgressEvent = previous;
  }
}

export async function withDocument<T>(
  run: () => Promise<T>
): Promise<T> {
  const window = new Window();
  Reflect.set(globalThis, "document", window.document);
  try {
    return await run();
  }
  finally {
    Reflect.deleteProperty(globalThis, "document");
    await window.happyDOM.close();
  }
}

export function dataFiles(
  files: Record<string, string>
): THREE.LoadingManager {
  const urls = new Map(Object.entries(files).map(([path, content]) => [
    path,
    `data:application/octet-stream;base64,${btoa(content)}`
  ]));

  return new THREE.LoadingManager().setURLModifier(
    (url) => urls.get(url.replace("/./", "/")) ?? url
  );
}
