// Import Third-party Dependencies
import type { PreferenceScope } from "@jolly-pixel/preferences";
import type {
  IconName,
  IconTone
} from "@jolly-pixel/ui";
import {
  CAMERA_PREFERENCES,
  COLOR_PICKER_PREFERENCES,
  LANTERN_PREFERENCES,
  RUNTIME_PREFERENCES
} from "@jolly-pixel/editor.host/preferences";
import {
  type EditorScopes,
  type KindPackageDescriptor,
  ProjectRights
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { STUDIO_PREFERENCES } from "../../../shared/preferences.ts";
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type { StudioUser } from "../../accounts/StudioUser.ts";
import type { ProjectDrafts } from "../../project/ProjectDrafts.ts";

// CONSTANTS
export const ACCOUNT_SECTION = "account";
export const APPEARANCE_SECTION = "appearance";
export const ACCESS_KEYS_SECTION = "access-keys";
export const GENERAL_SECTION = "project-general";
export const ACCESS_SETTINGS_SECTION = "project-access";
export const AUDIT_SECTION = "project-audit";
export const YOU_TAB = "you";
export const PROJECT_TAB = "project";
const kEditorPrefix = "editor:";
const kKindPackagePrefix = "kind-package:";
const kAppearanceScopes = new Set(
  [
    STUDIO_PREFERENCES,
    RUNTIME_PREFERENCES,
    LANTERN_PREFERENCES,
    COLOR_PICKER_PREFERENCES
  ].map((scope) => scope.name)
);
const kScopePresentations: ReadonlyMap<string, SectionPresentation> = new Map([
  [
    CAMERA_PREFERENCES.name,
    {
      label: CAMERA_PREFERENCES.label,
      icon: "camera",
      tone: "teal"
    }
  ]
]);
const kPages = {
  account: {
    id: ACCOUNT_SECTION,
    label: "Account",
    icon: "user",
    tone: "sky",
    kind: "account"
  },
  "access-keys": {
    id: ACCESS_KEYS_SECTION,
    label: "Access keys",
    icon: "key",
    tone: "amber",
    kind: "access-keys"
  },
  general: {
    id: GENERAL_SECTION,
    label: "General",
    icon: "settings",
    tone: "coral",
    kind: "general",
    unsaved: (drafts) => drafts.changedIn(
      ["kindFilter", "game", "physics", "snapshot"]
    ) || drafts.section("access").differsIn(
      (access) => [access.defaultRole, access.accessRequests]
    )
  },
  access: {
    id: ACCESS_SETTINGS_SECTION,
    label: "Access",
    icon: "shield",
    tone: "lime",
    kind: "access",
    unsaved: (drafts) => drafts.section("access").differsIn(
      (access) => access.toJSON().roles
    )
  },
  audit: {
    id: AUDIT_SECTION,
    label: "Audit",
    icon: "history",
    tone: "violet",
    kind: "audit"
  }
} satisfies Record<string, PageSection>;

interface SectionPresentation {
  label: string;
  icon?: IconName;
  tone?: IconTone;
}

interface SectionBase extends SectionPresentation {
  id: string;
  unsaved?(drafts: ProjectDrafts): boolean;
}

type PageKind =
  | "account"
  | "access-keys"
  | "general"
  | "access"
  | "audit";

export type PageSection = {
  [TKind in PageKind]: SectionBase & { kind: TKind; };
}[PageKind];

export interface PreferencesSection extends SectionBase {
  kind: "preferences";
  scopes: readonly PreferenceScope[];
  forms: readonly PreferenceScope[];
  keyBindings: readonly PreferenceScope[];
}

export interface KindPackageSection extends SectionBase {
  kind: "kind-package";
  packageName: string;
}

export type SettingsSection =
  | PageSection
  | PreferencesSection
  | KindPackageSection;

export interface SettingsGroup {
  id: string;
  label?: string;
  sections: readonly SettingsSection[];
}

export interface SettingsTab {
  id: typeof YOU_TAB | typeof PROJECT_TAB;
  label: string;
  icon: IconName;
  groups: readonly SettingsGroup[];
  first: SettingsSection;
  unsaved(drafts: ProjectDrafts): boolean;
}

export interface SettingsSectionsOptions {
  /**
   * The account adds Access keys; its project rights pick the Project
   * sections.
   */
  user: Pick<StudioUser, "online" | "rights">;
  /**
   * The studio and host scopes; editor scopes come with `editors`.
   */
  shellScopes: Iterable<PreferenceScope>;
  editors?: Iterable<EditorScopes>;
  kindPackages?: Iterable<KindPackageDescriptor>;
  kinds?: AssetKindSet;
}

export class SettingsSections implements Iterable<SettingsSection> {
  static readonly EMPTY = new SettingsSections({
    user: {
      online: false,
      rights: ProjectRights.NONE
    },
    shellScopes: []
  });

  readonly tabs: readonly SettingsTab[];
  readonly shortcutScopes: readonly PreferenceScope[];

  #sections: SettingsSection[];

  constructor(
    options: SettingsSectionsOptions
  ) {
    const {
      user,
      editors = [],
      kindPackages = [],
      kinds = AssetKindSet.EMPTY
    } = options;
    const shellScopes = [...options.shellScopes].filter(hasPage);

    const you: SettingsSection[] = [
      kPages.account,
      preferencesPage(
        APPEARANCE_SECTION,
        {
          label: "Appearance",
          icon: "palette",
          tone: "pink"
        },
        shellScopes.filter((scope) => kAppearanceScopes.has(scope.name))
      )
    ];
    for (const scope of shellScopes) {
      if (!kAppearanceScopes.has(scope.name)) {
        you.push(preferencesPage(
          scope.name,
          kScopePresentations.get(scope.name) ?? { label: scope.label },
          [scope]
        ));
      }
    }
    if (user.online) {
      you.push(kPages["access-keys"]);
    }

    this.tabs = [
      tab(
        {
          id: YOU_TAB,
          label: "You",
          icon: "user"
        },
        [
          group("you", undefined, you),
          group("editors", "Editors", editorPages([...editors], kinds))
        ]
      ),
      tab(
        {
          id: PROJECT_TAB,
          label: "Project",
          icon: "folder"
        },
        projectGroups(user.rights, [...kindPackages], kinds)
      )
    ].filter((entry) => entry !== null);
    this.#sections = this.tabs
      .flatMap((entry) => entry.groups)
      .flatMap((entry) => entry.sections);
    this.shortcutScopes = [
      ...new Map(this.#sections
        .flatMap((section) => (section.kind === "preferences" ? section.keyBindings : []))
        .map((scope) => [scope.name, scope]))
        .values()
    ];
  }

  get ids(): string[] {
    return this.#sections.map((section) => section.id);
  }

  get first(): SettingsSection | undefined {
    return this.#sections[0];
  }

  find(
    id: string
  ): SettingsSection | undefined {
    return this.#sections.find((section) => section.id === id);
  }

  tabHolding(
    id: string
  ): SettingsTab | undefined {
    return this.tabs.find((entry) => entry.groups.some(
      (settingsGroup) => settingsGroup.sections.some((section) => section.id === id)
    ));
  }

  [Symbol.iterator](): IterableIterator<SettingsSection> {
    return this.#sections.values();
  }
}

function projectGroups(
  project: ProjectRights,
  kindPackages: readonly KindPackageDescriptor[],
  kinds: AssetKindSet
): (SettingsGroup | null)[] {
  const pages: SettingsSection[] = [];
  const kindPackagePages: SettingsSection[] = [];
  if (project.allows("readSettings")) {
    pages.push(kPages.general);
    for (const kindPackage of kindPackages) {
      if (!kindPackage.configurable) {
        continue;
      }
      kindPackagePages.push({
        id: `${kKindPackagePrefix}${kindPackage.name}`,
        ...kindPresentation(kindPackage.name, kindPackage.kinds, kinds),
        kind: "kind-package",
        packageName: kindPackage.name,
        unsaved: (drafts) => drafts.section("kinds").differsIn(
          (kinds) => kinds.toJSON()[kindPackage.name]
        )
      });
    }
  }
  if (project.allows("manageAccess")) {
    pages.push(kPages.access);
  }
  if (project.allows("audit")) {
    pages.push(kPages.audit);
  }

  return [
    group("project", undefined, pages),
    group("assets", "Assets", kindPackagePages)
  ];
}

function tab(
  presentation: Pick<SettingsTab, "id" | "label" | "icon">,
  groups: readonly (SettingsGroup | null)[]
): SettingsTab | null {
  const shown = groups.filter((entry) => entry !== null);
  const sections = shown.flatMap((entry) => entry.sections);
  if (sections.length === 0) {
    return null;
  }

  return {
    ...presentation,
    groups: shown,
    first: sections[0],
    unsaved: (drafts) => sections.some(
      (section) => section.unsaved?.(drafts) ?? false
    )
  };
}

function editorPages(
  editors: readonly EditorScopes[],
  kinds: AssetKindSet
): SettingsSection[] {
  const shown = new Set(
    editors.flatMap(({ scopes }) => scopes.map(({ name }) => name))
  );
  const pages: SettingsSection[] = [];
  for (const editor of editors) {
    const adopted = editor.shared.filter((scope) => !shown.has(scope.name));
    for (const { name } of adopted) {
      shown.add(name);
    }

    const scopes = [...editor.scopes, ...adopted].filter(hasPage);
    if (scopes.length > 0) {
      pages.push(preferencesPage(
        `${kEditorPrefix}${editor.name}`,
        kindPresentation(editor.name, editor.kinds, kinds),
        scopes
      ));
    }
  }

  return pages;
}

function group(
  id: string,
  label: string | undefined,
  sections: readonly SettingsSection[]
): SettingsGroup | null {
  return sections.length === 0 ? null : {
    id,
    label,
    sections
  };
}

function hasPage(
  scope: PreferenceScope
): boolean {
  return scope.form.length > 0 || scope.keyBindings.length > 0;
}

function preferencesPage(
  id: string,
  presentation: SectionPresentation,
  scopes: readonly PreferenceScope[]
): SettingsSection {
  return {
    id,
    label: presentation.label,
    icon: presentation.icon,
    tone: presentation.tone,
    kind: "preferences",
    scopes,
    forms: scopes.filter((scope) => scope.form.length > 0),
    keyBindings: scopes.filter((scope) => scope.keyBindings.length > 0)
  };
}

function kindPresentation(
  name: string,
  kindList: readonly string[],
  kinds: AssetKindSet
): SectionPresentation {
  if (kindList.length === 0) {
    return { label: name };
  }

  return {
    label: kindList.map((kind) => kinds.kindLabel(kind)).join(", "),
    icon: kinds.kindIcon(kindList[0])
  };
}
