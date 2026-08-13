// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { formatCount } from "../../../../src/index.ts";

export const MONITOR_EXAMPLE: GalleryExample = {
  id: "monitors/monitor",
  title: "Monitor",
  group: "Monitors",
  render(host) {
    const state = {
      fps: 60,
      draws: 128
    };

    const fps = document.createElement("jolly-monitor");
    fps.label = "fps";
    fps.value = state.fps;

    const draws = document.createElement("jolly-monitor");
    draws.label = "draw calls";
    draws.value = state.draws;
    draws.format = formatCount;

    host.append(fps, draws);

    const timer = window.setInterval(() => {
      state.fps = 55 + Math.round(Math.random() * 10);
      state.draws = 100 + Math.round(Math.random() * 60);
      fps.value = state.fps;
      draws.value = state.draws;
    }, 500);

    return () => {
      window.clearInterval(timer);
      fps.remove();
      draws.remove();
    };
  }
};
