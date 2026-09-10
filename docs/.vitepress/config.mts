// Import Third-party Dependencies
import { defineConfig } from "vitepress";

// Import Internal Dependencies
import {
  packageGroups,
  documentedPackages
} from "./packages.mts";
import { sidebarForPackages } from "./sidebar.mts";
import { ignoredDeadLinks } from "./deadlinks.mts";

export default defineConfig({
  title: "JollyPixel",
  description: "The collaborative 3D HTML5 game maker",
  srcDir: "../packages",
  base: "/editor/",
  srcExclude: [
    "**/public/**",
    "**/node_modules/**",
    "**/CHANGELOG.md",
    "**/AGENTS.md",
    "**/CLAUDE.md",
    "**/SPEC.md",
    "**/PLAN.md",
    "**/examples/**",
    "bench/**",
    "editors/**"
  ],
  themeConfig: {
    nav: [
      ...packageGroups.map((group) => ({
        text: group.text,
        items: group.packages.map(({ dir, text }) => ({
          text,
          link: `/${dir}/README`,
          activeMatch: `^/${dir}/`
        }))
      }))
    ],
    search: {
      provider: "local"
    },
    sidebar: sidebarForPackages(documentedPackages.map(({ dir }) => dir)),
    socialLinks: [
      { icon: "github", link: "https://github.com/JollyPixel/editor" }
    ]
  },
  ignoreDeadLinks: ignoredDeadLinks,
  vite: {
    optimizeDeps: {
      entries: []
    }
  }
});
