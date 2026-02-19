// CONSTANTS
const kExamples = [
  { label: "Physics", path: "/" },
  { label: "Block Shapes", path: "/shapes.html" },
  { label: "Tileset UV", path: "/tileset.html" },
  { label: "Tiled Map", path: "/tiled.html" }
] as const;

/**
 * Injects a fixed navigation menu in the top-left corner of the page.
 * The current page's entry is highlighted; all others are clickable links.
 */
export function createExamplesMenu(): void {
  const currentPath = window.location.pathname;

  const nav = document.createElement("nav");
  Object.assign(nav.style, {
    position: "fixed",
    bottom: "12px",
    left: "12px",
    zIndex: "1000",
    background: "rgba(0,0,0,0.55)",
    borderRadius: "4px",
    padding: "6px 0",
    fontFamily: "monospace",
    minWidth: "130px"
  });

  const heading = document.createElement("div");
  heading.textContent = "Examples";
  Object.assign(heading.style, {
    color: "rgba(255,255,255,0.4)",
    padding: "0 12px 4px",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    marginBottom: "4px"
  });
  nav.appendChild(heading);

  for (const { label, path } of kExamples) {
    const isActive =
      currentPath === path ||
      (path === "/" && (currentPath === "/" || currentPath === "/index.html"));

    const a = document.createElement("a");
    a.href = path;
    a.textContent = label;
    Object.assign(a.style, {
      display: "block",
      padding: "3px 12px",
      fontSize: "11px",
      color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
      fontWeight: isActive ? "bold" : "normal",
      textDecoration: "none",
      cursor: isActive ? "default" : "pointer"
    });

    if (!isActive) {
      a.addEventListener("mouseenter", () => {
        a.style.color = "rgba(255,255,255,0.9)";
        a.style.background = "rgba(255,255,255,0.07)";
      });
      a.addEventListener("mouseleave", () => {
        a.style.color = "rgba(255,255,255,0.5)";
        a.style.background = "";
      });
    }

    nav.appendChild(a);
  }

  document.body.appendChild(nav);
}
