// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../../support/gallery.ts";

test.describe("Pane", () => {
  test("uses a larger left-origin pixel pattern", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/editor",
      chrome: "off"
    });

    const header = page.locator("jolly-pane > .header").first();
    const title = header.locator(".title");
    const colors = await header.evaluate((element) => {
      const accentProbe = document.createElement("span");
      const textProbe = document.createElement("span");
      accentProbe.style.backgroundColor = "var(--jolly-accent-fill)";
      textProbe.style.color = "var(--jolly-text-on-fill)";
      element.append(accentProbe, textProbe);
      const values = {
        accent: getComputedStyle(accentProbe).backgroundColor,
        background: getComputedStyle(element).backgroundColor,
        foreground: getComputedStyle(element).color,
        textOnFill: getComputedStyle(textProbe).color
      };
      accentProbe.remove();
      textProbe.remove();

      return values;
    });
    const pattern = await header.evaluate((element) => {
      const style = getComputedStyle(element, "::before");

      return {
        backgroundImage: style.backgroundImage,
        color: style.color,
        insetInlineStart: style.insetInlineStart,
        maskImage: style.maskImage,
        opacity: style.opacity
      };
    });

    expect(pattern.backgroundImage).toContain("conic-gradient");
    expect(pattern.color).toBe(colors.textOnFill);
    expect(pattern.insetInlineStart).toBe("0px");
    expect(pattern.maskImage).toContain("linear-gradient");
    expect(pattern.opacity).toBe("0.07");
    expect(colors.background).toBe(colors.accent);
    expect(colors.foreground).toBe(colors.textOnFill);
    await expect(title).toHaveCSS("font-weight", "600");
    await expect(title).toHaveCSS("letter-spacing", "0.88px");
  });
});
