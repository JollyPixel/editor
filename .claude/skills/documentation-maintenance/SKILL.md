---
name: documentation-maintenance
description: Audit, extract, rewrite, and synchronize source comments and Markdown API documentation. Use when asked to clean comments, move documentation out of code, refresh API docs, align docs with public exports, or remove AI-generated writing from technical documentation. Do not trigger for routine code edits that need only a small documentation adjustment.
---

# Documentation maintenance

Improve source comments and Markdown API documentation without changing runtime
behavior. Treat the implementation, public exports, and tests as evidence. Do
not invent a contract to fill a gap.

## Establish the scope

- Resolve the target workspace and files from the request. If a vague request
  would cover more than about five files, ask for a narrower scope.
- Read the repository `AGENTS.md`, the target workspace's `AGENTS.md` when it
  exists, and `.github/CODE_STYLE.md` before editing.
- Read neighboring comments and documentation to learn the established
  vocabulary, structure, and level of detail. Follow a workspace glossary when
  one exists.
- Determine the public surface from package entry points and exports. Confirm
  behavior against declarations, implementation, tests, and usage examples.

## Select the work

Apply the modes named by the user. A request may combine them.

### Clean source comments

Remove comments that narrate visible code, repeat a symbol's name, preserve dead
history, contain disabled code, or make claims the implementation no longer
supports.

Keep comments that explain rationale, invariants, ownership, lifetime,
mutability, units, defaults, bounds, failure behavior, or a necessary
workaround. Keep them close to the code they qualify.

Retain concise documentation on exported APIs for editor and IDE use unless the
workspace says otherwise. Move longer explanations, examples, and architectural
context into Markdown documentation when a suitable document exists.

### Synchronize Markdown API documentation

- Cover the actual exported surface rather than every internal declaration.
- Match current symbol names, signatures, type parameters, parameters, return
  values, thrown errors, defaults, bounds, and mutation behavior.
- Remove or correct stale entries. Preserve intentional compatibility notes and
  deprecation guidance.
- Prefer links to existing guides, ADRs, or examples over copying their content.
- Derive examples from verified behavior. Never add a plausible example that
  has not been checked against the code.

### Extract documentation from code

- Move public contracts and narrative material into the appropriate Markdown
  document.
- Leave behind only the source-level detail that helps someone safely modify or
  call the code.
- Avoid duplicating the same explanation in two places. When both source and
  Markdown need the fact, keep the source form short and make Markdown the
  detailed version.

## Handle existing and new prose

Use the two writing skills for different states of text. Do not run both over
the same fresh prose.

- For existing comments or documentation that need humanization, use the
  available `remove-ai-slop` skill. Follow its complete detect, fix, and verify
  workflow. Put its report and before-snapshot in scratch space unless the user
  asks to retain them in the repository.
- When the target is comments embedded in source code, extract only the scoped
  comments to a scratch file with source file and line labels. Run the prose
  analysis there, apply the approved wording changes back to the comments, and
  verify that executable code did not change.
- For new or replacement prose, use the available `write-without-slop` skill
  before drafting. Follow the surrounding document's voice and the repository
  style guide when either conflicts with its general writing rules.
- If either writing skill is unavailable, preserve its core constraints: use
  plain and concrete language, keep the author's voice, remove machine-like
  framing, and never invent facts or citations.

## Editing constraints

- Do not change runtime behavior while performing documentation maintenance.
- Do not broaden the public API to make the documentation easier to write.
- Do not silently choose between conflicting sources. Report the conflict and
  ask for direction when tests, implementation, and existing docs disagree in
  a way that changes the contract.
- Keep edits scoped. Do not rewrite unaffected sections for consistency alone.

## Validate and report

- Compare the finished documentation with the public exports again.
- Review the final changes for accidental code edits and stale links.
- Run the relevant workspace lint when source comments changed. Run the docs
  build when the changed Markdown is part of the generated documentation site.
- Summarize what was removed, retained, extracted, or synchronized. List any
  unresolved contract questions separately.
