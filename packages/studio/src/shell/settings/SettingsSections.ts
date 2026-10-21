// Import Third-party Dependencies
import type {
  IconName,
  TreeNode
} from "@jolly-pixel/ui";
import {
  LANTERN_PREFERENCES,
  RUNTIME_PREFERENCES,
  type PreferenceScope
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type {
  EditorScopes,
  KindPackageDescriptor
} from "../../editors/ProjectManifest.ts";
import { STUDIO_PREFERENCES } from "../../preferences/studioScope.ts";
import type { ProjectReply } from "../../project/routes.ts";

// CONSTANTS
export const PROFILE_SECTION = "profile";
export const APPEARANCE_SECTION = "appearance";
export const SHARE_LINKS_SECTION = "share-links";
export const GENERAL_SECTION = "project-general";
export const ACCESS_SETTINGS_SECTION = "project-access";
export const AUDIT_SECTION = "project-audit";
const kEditorPrefix = "editor:";
const kKindPackagePrefix = "kind-package:";
const kAppearanceScopes = new Set(
  [STUDIO_PREFERENCES, RUNTIME_PREFERENCES, LANTERN_PREFERENCES].map(
    (scope) => scope.name
  )
);
const kPages = {
  profile: {
    id: PROFILE_SECTION,
    label: "Profile",
    kind: "profile"
  },
  "share-links": {
    id: SHARE_LINKS_SECTION,
    label: "Share links",
    kind: "share-links"
  },
  general: {
    id: GENERAL_SECTION,
    label: "General",
    kind: "general"
  },
  access: {
    id: ACCESS_SETTINGS_SECTION,
    label: "Access",
    kind: "access"
  },
  audit: {
    id: AUDIT_SECTION,
    label: "Audit",
    kind: "audit"
  }
} satisfies Record<string, PageSection>;

interface SectionPresentation {
  label: string;
  icon?: IconName;
}

interface SectionBase extends SectionPresentation {
  id: string;
}

type PageKind = "profile" | "share-links" | "general" | "access" | "audit";

export type PageSection = {
  [TKind in PageKind]: SectionBase & { kind: TKind; };
}[PageKind];

export interface PreferencesSection extends SectionBase {
  kind: "preferences";
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

type SettingsNode = TreeNode<SettingsSection>;

export interface SettingsSectionsOptions {
  signedIn: boolean;
  /**
   * The studio and host scopes; editor scopes come with `editors`.
   */
  shellScopes: Iterable<PreferenceScope>;
  editors?: Iterable<EditorScopes>;
  kindPackages?: Iterable<KindPackageDescriptor>;
  kinds?: AssetKindSet;
  /**
   * The signed-in account's project rights, which pick the Project sections.
   */
  project?: ProjectReply | null;
}

export class SettingsSections implements Iterable<SettingsSection> {
  static readonly EMPTY = new SettingsSections({
    signedIn: false,
    shellScopes: []
  });

  readonly nodes: SettingsNode[];
  readonly headings: readonly string[];
  readonly shortcutScopes: readonly PreferenceScope[];

  #sections: SettingsSection[];

  constructor(
    options: SettingsSectionsOptions
  ) {
    const {
      signedIn,
      editors = [],
      kindPackages = [],
      kinds = AssetKindSet.EMPTY,
      project = null
    } = options;
    const shellScopes = [...options.shellScopes].filter(hasPage);

    const you: SettingsSection[] = [];
    if (signedIn) {
      you.push(kPages.profile);
    }
    you.push(preferencesPage(
      APPEARANCE_SECTION,
      { label: "Appearance" },
      shellScopes.filter((scope) => kAppearanceScopes.has(scope.name))
    ));
    for (const scope of shellScopes) {
      if (!kAppearanceScopes.has(scope.name)) {
        you.push(preferencesPage(scope.name, scope, [scope]));
      }
    }
    if (project !== null) {
      you.push(kPages["share-links"]);
    }

    this.nodes = [
      heading("you", "You", [
        ...you.map(leaf),
        heading("editors", "Editors", editorPages([...editors], kinds).map(leaf))
      ]),
      project === null ?
        null :
        projectHeading(project, [...kindPackages], kinds)
    ].filter((node) => node !== null);

    const flat = [...flatten(this.nodes)];
    this.#sections = flat.flatMap(
      (node) => (node.data === undefined ? [] : [node.data])
    );
    this.headings = flat
      .filter((node) => node.selectable === false)
      .map((node) => node.id);
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

  [Symbol.iterator](): IterableIterator<SettingsSection> {
    return this.#sections.values();
  }
}

function projectHeading(
  project: ProjectReply,
  kindPackages: readonly KindPackageDescriptor[],
  kinds: AssetKindSet
): SettingsNode | null {
  const pages: SettingsSection[] = [];
  const kindPackagePages: SettingsSection[] = [];
  if (project.canReadSettings) {
    pages.push(kPages.general);
    for (const kindPackage of kindPackages) {
      kindPackagePages.push({
        id: `${kKindPackagePrefix}${kindPackage.name}`,
        ...kindPresentation(kindPackage.name, kindPackage.kinds, kinds),
        kind: "kind-package",
        packageName: kindPackage.name
      });
    }
  }
  if (project.canManageAccess) {
    pages.push(kPages.access);
  }
  if (project.canAudit) {
    pages.push(kPages.audit);
  }

  return heading("project", "Project", [
    ...pages.map(leaf),
    heading("assets", "Assets", kindPackagePages.map(leaf))
  ]);
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

function heading(
  id: string,
  label: string,
  nodes: readonly (SettingsNode | null)[]
): SettingsNode | null {
  const children = nodes.filter((node) => node !== null);

  return children.length === 0 ? null : {
    id,
    label,
    selectable: false,
    children
  };
}

function leaf(
  section: SettingsSection
): SettingsNode {
  return {
    id: section.id,
    label: section.label,
    icon: section.icon,
    data: section
  };
}

function* flatten(
  nodes: readonly SettingsNode[]
): IterableIterator<SettingsNode> {
  for (const node of nodes) {
    yield node;
    yield* flatten(node.children ?? []);
  }
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
    kind: "preferences",
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
