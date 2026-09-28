// Import Node.js Dependencies
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { build } from "esbuild";
import { chromium, type Page } from "@playwright/test";

// Import Internal Dependencies
import type {
  BlendProbe,
  BlendProbeOptions
} from "./fixtures/tileBlending.ts";

// CONSTANTS
const kCellPixels = 32;
const kShadedRatio = 0.95;

type Colour = "red" | "blue" | "other";

interface ColumnHalves {
  left: Record<Colour, number>;
  right: Record<Colour, number>;
  shaded: Record<Exclude<Colour, "other">, number>;
}

function classify(
  pixels: number[],
  index: number
): Colour {
  const red = pixels[index];
  const blue = pixels[index + 2];
  if (red > 40 && blue < 10) {
    return "red";
  }

  return blue > 40 && red < 10 ? "blue" : "other";
}

function columnHalves(
  probe: BlendProbe
): ColumnHalves[] {
  const columns = Array.from({ length: probe.width / kCellPixels }, () => {
    return {
      left: { red: 0, blue: 0, other: 0 },
      right: { red: 0, blue: 0, other: 0 },
      shaded: { red: 0, blue: 0 }
    };
  });
  const brightest = { red: 0, blue: 0 };
  for (let index = 0; index < probe.pixels.length; index += 4) {
    brightest.red = Math.max(brightest.red, probe.pixels[index]);
    brightest.blue = Math.max(brightest.blue, probe.pixels[index + 2]);
  }
  for (let y = 0; y < probe.height; y++) {
    for (let x = 0; x < probe.width; x++) {
      const column = columns[Math.floor(x / kCellPixels)];
      const half = x % kCellPixels < kCellPixels / 2 ? column.left : column.right;
      const index = ((y * probe.width) + x) * 4;
      const colour = classify(probe.pixels, index);
      half[colour]++;
      const red = probe.pixels[index];
      const blue = probe.pixels[index + 2];
      if (colour === "red" && red < brightest.red * kShadedRatio) {
        column.shaded.red++;
      }
      else if (colour === "blue" && blue < brightest.blue * kShadedRatio) {
        column.shaded.blue++;
      }
    }
  }

  return columns;
}

function only(
  counts: Record<Colour, number>,
  colour: Colour
): boolean {
  return Object.entries(counts).every(
    ([key, count]) => (key === colour ? count > 0 : count === 0)
  );
}

async function render(
  page: Page,
  options: Omit<BlendProbeOptions, "forceWebGL">
): Promise<ColumnHalves[]> {
  const probe = await page.evaluate(async(probeOptions) => {
    const modulePath = "/probe.js";
    const { renderBlendScene }: typeof import("./fixtures/tileBlending.ts") =
      await import(modulePath);

    return renderBlendScene(probeOptions);
  }, {
    ...options,
    forceWebGL: process.env.VOXEL_TEST_WEBGPU !== "1"
  });

  return columnHalves(probe);
}

it("blends tiles of different groups texel by texel on the GPU", {
  timeout: 120_000
}, async() => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/tileBlending.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser"
  });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/probe.js" ?
      "text/javascript" : "text/html");
    response.end(request.url === "/probe.js" ? bundle.outputFiles[0].text :
      "<!doctype html><title>Tile blending</title>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      channel: process.env.VOXEL_TEST_BROWSER ?? "chrome",
      headless: true,
      args: ["--enable-unsafe-swiftshader", "--enable-unsafe-webgpu"]
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        errors.push(message.text());
      }
    });
    await page.goto(`http://127.0.0.1:${address.port}`);
    const blended = await render(page, {
      groups: ["grass", "dirt"],
      blendGroups: [
        { id: "grass", width: 3 },
        { id: "dirt", width: 3, pattern: "bayer" }
      ]
    });
    assert.deepEqual(errors, []);
    assert.ok(only(blended[0].left, "red") && only(blended[0].right, "red"));
    assert.ok(only(blended[1].left, "red"), "grass keeps its inner half");
    assert.ok(blended[1].right.blue > 0 && blended[1].right.red > 0);
    assert.equal(blended[1].right.other, 0, "texels are picked, never mixed");
    assert.ok(blended[2].left.red > 0 && blended[2].left.blue > 0);
    assert.equal(blended[2].left.other, 0, "texels are picked, never mixed");
    assert.ok(only(blended[2].right, "blue"), "dirt keeps its inner half");
    assert.ok(only(blended[3].left, "blue") && only(blended[3].right, "blue"));
    assert.deepEqual(
      [blended[0].shaded, blended[3].shaded],
      [{ red: 0, blue: 0 }, { red: 0, blue: 0 }],
      "texels away from a border keep their colour"
    );
    assert.ok(
      blended[1].shaded.blue + blended[2].shaded.blue > 0,
      "the upper tile of an equal edge is outlined"
    );

    const covered = await render(page, {
      groups: ["grass", "dirt"],
      blendGroups: [
        { id: "grass", width: 3, priority: 1 },
        { id: "dirt", width: 3 }
      ]
    });
    assert.deepEqual(errors, []);
    assert.ok(only(covered[1].left, "red") && only(covered[1].right, "red"));
    assert.deepEqual(
      covered[1].shaded,
      { red: 0, blue: 0 },
      "the covering group owns the texels beside its edge"
    );
    assert.ok(covered[2].left.red > 0 && covered[2].left.blue > 0);
    assert.equal(covered[2].left.other, 0, "texels are picked, never mixed");
    assert.ok(covered[2].shaded.red > 0, "the covering tile is outlined");
    assert.ok(covered[2].shaded.blue > 0, "the covered tile takes a shadow");
    assert.ok(only(covered[2].right, "blue"), "dirt keeps its inner half");

    const grouped = await render(page, {
      groups: ["ground", "ground"],
      blendGroups: [{ id: "ground" }]
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(
      grouped.map(({ left, right }) => [left, right].every(
        (half) => half.other === 0 && (half.red === 0 || half.blue === 0)
      )),
      [true, true, true, true]
    );
    assert.ok(only(grouped[1].right, "red") && only(grouped[2].left, "blue"));
  }
  finally {
    await browser?.close();
    server.close();
    await once(server, "close");
  }
});
