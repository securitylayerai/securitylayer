# SecurityLayer

Agent security platform that makes dangerous AI agent actions **structurally impossible**.

## Research & Specs (Private)

Full technical specifications and architecture docs live in the sibling `research/` repo (NOT in this opensource repo). **Always read these before working on this project:**

- `../research/CLAUDE.md` — Full project instructions, architecture, design principles, conventions
- `../research/1-technical-specs.md` — Complete technical specification (v2.0)
- `../research/2-integration-strategies.md` — Integration strategies for Claude Code, Cursor, shell shim, SDK, eBPF

These files contain the authoritative architecture, design principles, monorepo structure, taint levels, capability system, implementation milestones, and coding conventions. Read them for full context on any task.

## Quick Reference

- **Runtime:** Bun + TypeScript
- **Monorepo:** Bun workspaces (`packages/*`)
- **Testing:** Vitest (`bun test`)
- **CLI UX:** `@clack/prompts` + `@bomb.sh/args` + `@bomb.sh/tab`
- **Packages:** `@securitylayer/core`, `cli`, `proxy`, `sdk`, `adapters`, `rules-baseline`
- **Core philosophy:** Don't detect bad actions. Make them impossible.

## Commit Messages

- Do not include "Generated with" or co-authorship lines
