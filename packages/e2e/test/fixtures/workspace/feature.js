import "./feature.js";
import "@jolly-pixel/feature";

new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
new URL("./asset.png", import.meta.url);
