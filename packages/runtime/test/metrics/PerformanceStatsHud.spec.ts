// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { StatsRecorder } from "@jolly-pixel/ui/stats";
import {
  GameLoop,
  ManualFrameSource
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  PerformanceStatsHud,
  type PerformanceStatsHost
} from "../../src/metrics/PerformanceStatsHud.ts";
import { OverlayLayer } from "../../src/overlay/OverlayLayer.ts";

describe("PerformanceStatsHud", () => {
  test("shows the idle badge on a loop already asleep", () => {
    const { host, source, dispose } = createHost(0);
    host.loop.start();
    assert.equal(source.running, false);

    const hud = new PerformanceStatsHud(host);

    try {
      assert.equal(queryBadge(host).hidden, false);
    }
    finally {
      hud.dispose();
      dispose();
    }
  });

  test("the idle badge follows the loop sleeping and waking", () => {
    const { host, source, dispose } = createHost(1);
    host.loop.start();

    const hud = new PerformanceStatsHud(host);

    try {
      const badge = queryBadge(host);
      assert.equal(badge.hidden, true);

      source.step(16);
      assert.equal(badge.hidden, false);

      host.loop.invalidate();
      assert.equal(badge.hidden, true);

      source.step(16);
      host.loop.stop();
      assert.equal(badge.hidden, true);
    }
    finally {
      hud.dispose();
      dispose();
    }
  });

  test("hidden hides the mounted HUD until shown again", () => {
    const { host, dispose } = createHost(0);
    const hud = new PerformanceStatsHud(host);
    const frame = queryBadge(host).parentElement!;

    try {
      assert.equal(hud.hidden, false);

      hud.hidden = true;
      assert.equal(frame.hidden, true);
      assert.equal(host.overlay.element.contains(frame), true);

      hud.hidden = false;
      assert.equal(frame.hidden, false);
    }
    finally {
      hud.dispose();
      dispose();
    }
  });

  test("dispose() unmounts the HUD and stops following the loop", () => {
    const { host, source, dispose } = createHost(1);
    host.loop.start();
    const hud = new PerformanceStatsHud(host);
    const badge = queryBadge(host);

    hud.dispose();
    source.step(16);

    assert.equal(host.overlay.element.childElementCount, 0);
    assert.equal(badge.hidden, true);
    dispose();
  });
});

function createHost(
  trailingRenders: number
) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const source = new ManualFrameSource();
  const host: PerformanceStatsHost = {
    recorder: new StatsRecorder(),
    overlay: new OverlayLayer(canvas),
    loop: new GameLoop({
      source,
      keepAlive: () => false,
      trailingRenders
    })
  };

  return {
    host,
    source,
    dispose(): void {
      host.overlay.dispose();
      canvas.remove();
    }
  };
}

function queryBadge(
  host: PerformanceStatsHost
): HTMLElement {
  const badge = [...host.overlay.element.querySelectorAll("span")]
    .find((element) => element.textContent === "IDLE");
  assert.ok(badge);

  return badge;
}
