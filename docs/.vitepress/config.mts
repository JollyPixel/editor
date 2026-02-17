// Import Third-party Dependencies
import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "JollyPixel",
  description: "The collaborative 3D HTML5 game maker",
  themeConfig: {
    nav: [
      { text: "Engine", link: "/engine/README", activeMatch: "^/engine/" },
      { text: "Runtime", link: "/runtime/README", activeMatch: "^/runtime/" },
      { text: "FSTree", link: "/fs-tree/README", activeMatch: "^/fs-tree/" },
      {
        text: "Editors",
        items: [
          { text: "Voxel Map", link: "/editors/voxel-map/README", activeMatch: "^/editors/voxel-map/" },
          { text: "Model", link: "/editors/model/README", activeMatch: "^/editors/model/" }
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
                  link: "/engine/guides/hello-world"
                }
              ]
            },
            {
              text: "Actor",
              items: [
                {
                  text: "Actor",
                  link: "/engine/actor/actor"
                },
                {
                  text: "ActorComponents",
                  link: "/engine/actor/actor-component"
                },
                {
                  text: "ActorTransform",
                  link: "/engine/actor/actor-transform"
                },
                {
                  text: "ActorTree",
                  link: "/engine/actor/actor-tree"
                }
              ]
            },
            {
              text: "Audio",
              items: [
                {
                  text: "Audio",
                  link: "/engine/audio/audio"
                },
                {
                  text: "AudioBackground",
                  link: "/engine/audio/audio-background"
                }
              ]
            },
            {
              text: "Components",
              items: [
                {
                  text: "Behavior",
                  link: "/engine/components/behavior"
                },
                {
                  text: "Camera3DControls",
                  link: "/engine/components/camera-3d-controls"
                },
                {
                  text: "Renderers",
                  link: "/engine/components/renderers"
                },
                {
                  text: "Signal",
                  link: "/engine/components/signal"
                }
              ]
            },
            {
              text: "Controls",
              items: [
                {
                  text: "CombinedInput",
                  link: "/engine/controls/combinedinput"
                },
                {
                  text: "Gamepad",
                  link: "/engine/controls/gamepad"
                },
                {
                  text: "Input",
                  link: "/engine/controls/input"
                },
                {
                  text: "Keyboard",
                  link: "/engine/controls/keyboard"
                },
                {
                  text: "Mouse",
                  link: "/engine/controls/mouse"
                },
                {
                  text: "Screen",
                  link: "/engine/controls/screen"
                },
                {
                  text: "Touchpad",
                  link: "/engine/controls/touchpad"
                }
              ]
            },
            {
              text: "Systems",
              items: [
                {
                  text: "Renderer",
                  link: "/engine/systems/renderer"
                },
                {
                  text: "SceneManager",
                  link: "/engine/systems/scene-manager"
                },
                {
                  text: "World",
                  link: "/engine/systems/world"
                }
              ]
            },
            {
              text: "UI",
              items: [
                {
                  text: "UINode",
                  link: "/engine/ui/ui-node"
                },
                {
                  text: "UIRenderer",
                  link: "/engine/ui/ui-renderer"
                },
                {
                  text: "UISprite",
                  link: "/engine/ui/ui-sprite"
                }
              ]
            },
            {
              text: "Internals",
              items: [
                {
                  text: "Adapters",
                  link: "/engine/internals/adapters"
                },
                {
                  text: "Audio",
                  link: "/engine/internals/audio"
                },
                {
                  text: "FixedTimeStep",
                  link: "/engine/internals/fixed-time-step"
                }
              ]
            },
            {
              text: "Assets",
              items: [
                {
                  text: "Asset",
                  link: "/engine/asset"
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
              text: "Runtime",
              link: "/runtime/Runtime"
            }
          ]
        }
      ],
      "/fs-tree/": [
        {
          items: [
            {
              text: "FSTree",
              link: "/fs-tree/FSTree"
            },
            {
              text: "FSTreeSynchronizer",
              link: "/fs-tree/FSTreeSynchronizer"
            },
            {
              text: "TreeView",
              link: "/fs-tree/TreeView"
            }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/JollyPixel/editor" }
    ]
  },
  base: "/jollypixel/",
  rewrites: {
    ":packages/docs/(.*)": ":packages/(.*)"
  },
  srcDir: "../packages",
  ignoreDeadLinks: true
});
