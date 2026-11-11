// Import Internal Dependencies
import {
  expect,
  test
} from "./fixtures.ts";

// CONSTANTS
const kDocument = [
  "<p align=\"center\">\n  <img src=\"banner.png\" alt=\"Banner\">\n</p>",
  "# Title",
  "First *paragraph* with a [link][home], `<b>` and <https://example.com>.",
  "Second *paragraph*.",
  "---",
  "- one\n- two",
  "---",
  "Last *paragraph*.",
  "[home]: https://example.com/home"
].join("\n\n");
const kEdits = [
  kDocument.replace("Second", "Edited"),
  `Intro.\n\n${kDocument}`,
  `${kDocument}\n\nOutro.`,
  kDocument.replace("- one\n- two\n\n---\n\n", ""),
  kDocument.replace("[home].\n\nSecond", "[home].\nSecond"),
  kDocument.replace("example.com/home", "example.com/away"),
  kDocument.replace("Second *paragraph*.", "<details>\n\nInside *details*.\n\n</details>"),
  kDocument.replace("Second *paragraph*.", "Open <b>bold"),
  kDocument
];

test("the Markdown preview renders each edit as a fresh render of the text", async({ page }) => {
  const renders = await page.evaluate(async(edits) => {
    const module = "/src/markdown/MarkdownView.ts";
    await import(module);
    function html(
      markdown: string,
      view = document.createElement("jolly-markdown")
    ): string {
      view.markdown = markdown;

      return view.shadowRoot?.querySelector("article")?.innerHTML ?? "";
    }
    const edited = document.createElement("jolly-markdown");

    return edits.map((markdown) => [html(markdown, edited), html(markdown)]);
  }, [kDocument, ...kEdits]);

  for (const [edited, fresh] of renders) {
    expect(edited).toBe(fresh);
  }
});

test("the Markdown preview keeps the elements of the blocks an edit leaves alone", async({ page }) => {
  const kept = await page.evaluate(async({ before, after }) => {
    const module = "/src/markdown/MarkdownView.ts";
    await import(module);
    const view = document.createElement("jolly-markdown");
    function paragraphs(): HTMLParagraphElement[] {
      return Array.from(view.shadowRoot?.querySelectorAll("p") ?? []);
    }
    view.markdown = before;
    const [banner, first, second, last] = paragraphs();
    view.markdown = after;
    const [bannerAfter, firstAfter, secondAfter, lastAfter] = paragraphs();

    return [
      bannerAfter === banner,
      firstAfter === first,
      secondAfter === second,
      lastAfter === last
    ];
  }, {
    before: kDocument,
    after: kDocument.replace("Second", "Edited")
  });

  expect(kept).toEqual([true, true, false, true]);
});
