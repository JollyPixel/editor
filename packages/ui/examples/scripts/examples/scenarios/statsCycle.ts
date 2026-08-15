// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { StatsRecorder } from "../../../../src/stats/StatsRecorder.ts";

export const STATS_CYCLE_EXAMPLE: GalleryExample = {
  id: "scenarios/stats-cycle",
  title: "Stats cycle",
  group: "Scenarios",
  render(host) {
    const recorder = new StatsRecorder();
    const started = performance.now();
    recorder.addMetric({
      id: "entities",
      label: "ENTITIES",
      min: 0,
      better: "lower",
      sample: () => 600 + Math.round(
        Math.sin((performance.now() - started) / 800) * 200
      )
    });

    const stats = document.createElement("jolly-stats");
    stats.recorder = recorder;
    stats.storageKey = "jolly-ui-gallery:stats-cycle";
    host.append(stats);

    let frame = 0;
    function update() {
      recorder.begin();
      recorder.end();
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frame);
      stats.remove();
    };
  }
};
