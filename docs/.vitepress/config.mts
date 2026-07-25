// Import Third-party Dependencies
import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "JollyPixel",
  description: "The collaborative 3D HTML5 game maker",
  srcExclude: [
    "**/public/**",
    "packages/editors/voxel-model/src/components/**"
  ],
  themeConfig: {
    nav: [
      {
        text: "Packages",
        items: [
          { text: "Engine", link: "/engine/README", activeMatch: "^/engine/" },
          { text: "Runtime", link: "/runtime/README", activeMatch: "^/runtime/" },
          { text: "Voxel Renderer", link: "/voxel-renderer/README", activeMatch: "^/voxel-renderer/" },
          { text: "Pixel Draw", link: "/pixel-draw-renderer/README", activeMatch: "^/pixel-draw-renderer/" },
          { text: "Network", link: "/network/README", activeMatch: "^/network/" }
        ]
      }
    ],
    search: {
      provider: "local"
    },
    sidebar: {
      "/engine/": [
        {
          items: [
            {
              text: "Guides",
              items: [
                {
                  text: "Hello World",
                  link: "/engine/docs/guides/hello-world"
                }
              ]
            },
            {
              text: "Actor",
              items: [
                {
                  text: "Actor",
                  link: "/engine/docs/actor/actor"
                },
                {
                  text: "ActorComponents",
                  link: "/engine/docs/actor/actor-component"
                },
                {
                  text: "ActorTransform",
                  link: "/engine/docs/actor/actor-transform"
                },
                {
                  text: "ActorTree",
                  link: "/engine/docs/actor/actor-tree"
                }
              ]
            },
            {
              text: "Audio",
              items: [
                {
                  text: "Audio",
                  link: "/engine/docs/audio/audio"
                },
                {
                  text: "AudioBackground",
                  link: "/engine/docs/audio/audio-background"
                },
                {
                  text: "AudioLibrary",
                  link: "/engine/docs/audio/audio-library"
                }
              ]
            },
            {
              text: "Components",
              items: [
                {
                  text: "Behavior",
                  link: "/engine/docs/components/behavior"
                },
                {
                  text: "Camera3DControls",
                  link: "/engine/docs/components/camera-3d-controls"
                },
                {
                  text: "Renderers",
                  link: "/engine/docs/components/renderers"
                },
                {
                  text: "Signal",
                  link: "/engine/docs/components/signal"
                }
              ]
            },
            {
              text: "Controls",
              items: [
                {
                  text: "CombinedInput",
                  link: "/engine/docs/controls/combinedinput"
                },
                {
                  text: "Gamepad",
                  link: "/engine/docs/controls/gamepad"
                },
                {
                  text: "Input",
                  link: "/engine/docs/controls/input"
                },
                {
                  text: "Keyboard",
                  link: "/engine/docs/controls/keyboard"
                },
                {
                  text: "Mouse",
                  link: "/engine/docs/controls/mouse"
                },
                {
                  text: "Screen",
                  link: "/engine/docs/controls/screen"
                },
                {
                  text: "Touchpad",
                  link: "/engine/docs/controls/touchpad"
                }
              ]
            },
            {
              text: "Systems",
              items: [
                {
                  text: "Renderer",
                  link: "/engine/docs/systems/renderer"
                },
                {
                  text: "SceneManager",
                  link: "/engine/docs/systems/scene-manager"
                },
                {
                  text: "World",
                  link: "/engine/docs/systems/world"
                }
              ]
            },
            {
              text: "UI",
              items: [
                {
                  text: "UINode",
                  link: "/engine/docs/ui/ui-node"
                },
                {
                  text: "UIRenderer",
                  link: "/engine/docs/ui/ui-renderer"
                },
                {
                  text: "UISprite",
                  link: "/engine/docs/ui/ui-sprite"
                }
              ]
            },
            {
              text: "Internals",
              items: [
                {
                  text: "Adapters",
                  link: "/engine/docs/internals/adapters"
                },
                {
                  text: "Audio",
                  link: "/engine/docs/internals/audio"
                },
                {
                  text: "FixedTimeStep",
                  link: "/engine/docs/internals/fixed-time-step"
                }
              ]
            },
            {
              text: "Assets",
              items: [
                {
                  text: "Asset",
                  link: "/engine/docs/asset"
                }
              ]
            }
          ]
        }
      ],
      "/runtime/": [
        {
          items: [
            {
              text: "Introduction",
              link: "/runtime/README"
            },
            {
              text: "APIs",
              items: [
                {
                  text: "Runtime",
                  link: "/runtime/docs/Runtime"
                }
              ]
            },
            {
              text: "Supported platforms",
              items: [
                {
                  text: "Desktop",
                  link: "/runtime/docs/platforms/desktop"
                },
                {
                  text: "Web",
                  link: "/runtime/docs/platforms/web"
                }
              ]
            },

          ]
        }
      ],
      "/voxel-renderer/": [
        {
          items: [
            {
              text: "Introduction",
              link: "/voxel-renderer/README"
            },
            {
              text: "Core",
              items: [
                {
                  text: "VoxelRenderer",
                  link: "/voxel-renderer/docs/VoxelRenderer"
                },
                {
                  text: "VoxelEngine",
                  link: "/voxel-renderer/docs/VoxelEngine"
                },
                {
                  text: "World",
                  link: "/voxel-renderer/docs/World"
                },
                {
                  text: "Layer",
                  link: "/voxel-renderer/docs/Layer"
                },
                {
                  text: "Blocks",
                  link: "/voxel-renderer/docs/Blocks"
                }
              ]
            },
            {
              text: "Tilesets",
              items: [
                {
                  text: "Tileset",
                  link: "/voxel-renderer/docs/Tileset"
                },
                {
                  text: "Built-In Shapes",
                  link: "/voxel-renderer/docs/BuiltInShapes"
                },
                {
                  text: "TiledConverter",
                  link: "/voxel-renderer/docs/TiledConverter"
                }
              ]
            },
            {
              text: "Advanced",
              items: [
                {
                  text: "Collision",
                  link: "/voxel-renderer/docs/Collision"
                },
                {
                  text: "Serialization",
                  link: "/voxel-renderer/docs/Serialization"
                },
                {
                  text: "Hooks",
                  link: "/voxel-renderer/docs/Hooks"
                }
              ]
            }
          ]
        }
      ],
      "/pixel-draw-renderer/": [
        {
          items: [
            {
              text: "Introduction",
              link: "/pixel-draw-renderer/README"
            },
            {
              text: "Core",
              items: [
                {
                  text: "PixelArtCanvas",
                  link: "/pixel-draw-renderer/docs/PixelArtCanvas"
                }
              ]
            },
            {
              text: "Tools",
              items: [
                {
                  text: "Brush",
                  link: "/pixel-draw-renderer/docs/tools/Brush"
                },
                {
                  text: "BrushTool",
                  link: "/pixel-draw-renderer/docs/tools/BrushTool"
                },
                {
                  text: "FillTool",
                  link: "/pixel-draw-renderer/docs/tools/FillTool"
                },
                {
                  text: "SelectTool",
                  link: "/pixel-draw-renderer/docs/tools/SelectTool"
                }
              ]
            },
            {
              text: "Buffer",
              items: [
                {
                  text: "PixelBuffer",
                  link: "/pixel-draw-renderer/docs/buffer/PixelBuffer"
                }
              ]
            },
            {
              text: "Input",
              items: [
                {
                  text: "Keybindings",
                  link: "/pixel-draw-renderer/docs/input/Keybindings"
                }
              ]
            },
            {
              text: "Network",
              items: [
                {
                  text: "Overview",
                  link: "/pixel-draw-renderer/docs/network/index"
                },
                {
                  text: "PixelSyncSession",
                  link: "/pixel-draw-renderer/docs/network/PixelSyncSession"
                },
                {
                  text: "PixelSyncServer",
                  link: "/pixel-draw-renderer/docs/network/PixelSyncServer"
                }
              ]
            },
            {
              text: "Advanced",
              items: [
                {
                  text: "UVMap",
                  link: "/pixel-draw-renderer/docs/uv/UVMap"
                },
                {
                  text: "HistoryStack",
                  link: "/pixel-draw-renderer/docs/history/HistoryStack"
                }
              ]
            }
          ]
        }
      ],
      "/network/": [
        {
          items: [
            {
              text: "Introduction",
              link: "/network/README"
            },
            {
              text: "Core",
              items: [
                {
                  text: "Client",
                  link: "/network/docs/Client"
                },
                {
                  text: "Room",
                  link: "/network/docs/Room"
                },
                {
                  text: "Server",
                  link: "/network/docs/Server"
                },
                {
                  text: "ServerRoom",
                  link: "/network/docs/ServerRoom"
                }
              ]
            },
            {
              text: "Transport",
              items: [
                {
                  text: "Websocket",
                  link: "/network/docs/transport/websocket"
                }
              ]
            },
            {
              text: "Plugins",
              items: [
                {
                  text: "Vite",
                  link: "/network/docs/plugins/vite"
                }
              ]
            }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/JollyPixel/editor" }
    ]
  },
  base: "/editor/",
  srcDir: "../packages",
  ignoreDeadLinks: true,
  vite: {
    optimizeDeps: {
      // `srcDir` makes the whole `packages/` tree the Vite root, so the default
      // `**/*.html` dependency scan picks up unrelated apps (editors, examples)
      // whose Lit decorators esbuild's scanner can't parse. Disable the crawl.
      entries: []
    }
  }
});
