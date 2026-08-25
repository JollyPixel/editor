// Theme
export {
  themeStyles
} from "./theme/styles/themeStyles.ts";
export {
  themeTokens
} from "./theme/tokens/semantic.ts";
export {
  densityTokens
} from "./theme/tokens/density.ts";
export {
  scaleTokens
} from "./theme/tokens/scales.ts";
export {
  peerColor
} from "./theme/peerColor.ts";
export {
  ensureFontFace,
  fontFaceCss
} from "./theme/font.ts";
export type {
  Density,
  ThemeMode
} from "./theme/types.ts";
export {
  ScopeHost
} from "./theme/components/ScopeHost.ts";
export {
  ThemeControl
} from "./theme/components/ThemeControl.ts";
export {
  DensityControl
} from "./theme/components/DensityControl.ts";
export {
  ThemePreferences
} from "./theme/components/ThemePreferences.ts";
export type {
  ThemePreferencesLayout
} from "./theme/components/ThemePreferences.ts";
export {
  resolveThemeColor,
  resolveThemeToken
} from "./theme/resolveThemeToken.ts";

// Geometry
export type {
  Rect
} from "./geometry/Rect.ts";

// Storage
export type {
  StorageAdapter
} from "./storage/StorageAdapter.ts";
export {
  LocalStorageAdapter,
  type LocalStorageAdapterOptions,
  type StorageLike
} from "./storage/LocalStorageAdapter.ts";
export {
  MemoryStorageAdapter
} from "./storage/MemoryStorageAdapter.ts";

// Field infrastructure
export {
  Mixed,
  isMixed,
  type FieldValue
} from "./field/mixed.ts";
export type {
  FieldAlign,
  FieldLabelPosition
} from "./field/JollyField.ts";
export type {
  JollyChangeDetail
} from "./field/events.ts";
export type {
  CollaboratorPresence
} from "./peer/types.ts";

// Peer presence
export {
  PresenceElement,
  type PresencePeer
} from "./peer/Presence.ts";
export {
  NullPresenceSource,
  type LockState,
  type PresenceSource
} from "./peer/PresenceSource.ts";
export { toPresencePeers } from "./peer/toPresencePeers.ts";

// Icons
export {
  Icon,
  getIcon,
  hasIcon,
  registerIcon,
  type BuiltinIconName,
  type IconGlyph,
  type IconName
} from "./icon/index.ts";

// Controls
export {
  Button,
  type ButtonVariant
} from "./controls/Button.ts";
export {
  ButtonGroup
} from "./controls/ButtonGroup.ts";
export {
  Checkbox
} from "./controls/Checkbox.ts";
export {
  Color
} from "./controls/Color.ts";
export {
  ColorPicker
} from "./controls/ColorPicker.ts";
export {
  Control
} from "./controls/Control.ts";
export {
  Controls,
  type ControlsPosition
} from "./controls/Controls.ts";
export {
  Flags
} from "./controls/Flags.ts";
export {
  NumberField
} from "./controls/Number.ts";
export {
  PropertyRow
} from "./controls/PropertyRow.ts";
export {
  Range
} from "./controls/Range.ts";
export {
  Select
} from "./controls/Select.ts";
export {
  Separator
} from "./controls/Separator.ts";
export {
  Slider
} from "./controls/Slider.ts";
export {
  Text
} from "./controls/Text.ts";
export type {
  Interval,
  JollyOption
} from "./controls/types.ts";

// Math
export {
  Vector2
} from "./math/Vector2.ts";
export {
  Vector3
} from "./math/Vector3.ts";
export {
  Vector4
} from "./math/Vector4.ts";
export {
  Quaternion
} from "./math/Quaternion.ts";
export {
  Transform
} from "./math/Transform.ts";
export {
  Point2d
} from "./math/Point2d.ts";
export type {
  QuatLike,
  TransformLike,
  Vec3Like,
  VectorValue
} from "./math/types.ts";

// Interaction
export {
  PopoverController,
  type PopoverControllerOptions
} from "./field/PopoverController.ts";
export {
  startDragSession,
  horizontalInsertionLine,
  verticalInsertionLine,
  type DragResult,
  type DragSessionHandle,
  type DragSessionOptions,
  type DragZone
} from "./interaction/drag/DragSession.ts";
export {
  resolveDropIndex,
  type DropCandidate,
  type ResolveDropIndexOptions
} from "./interaction/drag/dropIndex.ts";
export {
  copyTheme,
  headerGhost,
  themeTokenNames,
  type GhostSource
} from "./interaction/drag/dragGhost.ts";

// Containers
export {
  Dialog
} from "./containers/Dialog.ts";
export {
  showConfirm,
  showPrompt,
  resolveStoredPrompt,
  type ConfirmOptions,
  type PromptOptions,
  type StoredPromptOptions
} from "./containers/dialogHelpers.ts";
export {
  Dock,
  type DockAlign,
  type DockSide
} from "./containers/Dock.ts";
export {
  DockLayout
} from "./containers/DockLayout.ts";
export {
  Floating
} from "./containers/Floating.ts";
export {
  Folder
} from "./containers/Folder.ts";
export {
  PaneElement
} from "./containers/Pane.ts";
export {
  Rail,
  type RailOrientation
} from "./containers/Rail.ts";
export {
  Tab
} from "./containers/Tab.ts";
export {
  Tabs,
  type TabsOrientation
} from "./containers/Tabs.ts";
export {
  Toolbar,
  type ToolbarOrientation
} from "./containers/Toolbar.ts";
export {
  emptyLayout,
  parseLayout,
  reconcileLayout,
  serializeLayout,
  type DeclaredDock,
  type DeclaredLayout,
  type DockState,
  type FloatingState,
  type LayoutSnapshot,
  type PaneState
} from "./containers/layout.ts";
export type {
  ContainerEventMap,
  JollyMoveDetail,
  JollyReorderDetail,
  JollyResizeDetail,
  JollyTabChangeDetail,
  JollyToggleDetail
} from "./containers/events.ts";

// Data views
export {
  Tree
} from "./data/Tree.ts";
export {
  canDrop,
  resolveReparent
} from "./data/resolveReparent.ts";
export {
  resolveRowDropZone
} from "./data/dropZone.ts";
export {
  resolveSelection
} from "./data/selection.ts";
export {
  findNode,
  findParentId,
  flattenVisible,
  isSelfOrDescendant,
  type FlatTreeRow
} from "./data/treeNodes.ts";
export type {
  JollyActivateDetail,
  JollyReparentDetail,
  JollySelectDetail,
  JollyToggleExpandDetail,
  JollyToggleLockDetail,
  JollyToggleVisibleDetail,
  TreeDropWhere,
  TreeNode
} from "./data/Tree.types.ts";
export type {
  DataEventMap
} from "./data/events.ts";

// Monitors
export {
  MonitorElement
} from "./monitors/Monitor.ts";
export {
  GraphElement,
  type GraphDefaults
} from "./monitors/Graph.ts";
export {
  formatCount,
  formatMilliseconds,
  formatPercent
} from "./monitors/format.ts";
export {
  StatsElement
} from "./stats/Stats.ts";

// Feedback
export {
  Progress
} from "./feedback/Progress.ts";
export {
  Loading
} from "./feedback/Loading.ts";

// Facade
export {
  Pane,
  type PaneOptions
} from "./facade/Pane.ts";
export {
  DockFacade
} from "./facade/Dock.ts";
export type {
  Disposable,
  MonitorFields
} from "./facade/Container.ts";
export type {
  FolderOptions
} from "./facade/Folder.ts";
export type {
  BindingChangeEvent,
  BindingChangeHandler,
  BindingOptions
} from "./facade/Binding.ts";
export type {
  MonitorKey,
  MonitorOptions
} from "./facade/Monitor.ts";
export type {
  ButtonOptions
} from "./facade/Button.ts";
export {
  Presence,
  type PresenceOptions
} from "./facade/Presence.ts";

// DOM
export {
  detailOf,
  isButtonElement,
  isDocumentOrShadowRoot,
  isInputElement,
  isSelectElement,
  isSlotElement
} from "./dom.ts";
