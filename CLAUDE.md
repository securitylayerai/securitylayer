# Security Layer

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
- **Testing:** Vitest (`bun run test`) — do NOT use `bun test` (that invokes Bun's built-in runner, not Vitest)
- **CLI UX:** `@clack/prompts` + `@bomb.sh/args` + `@bomb.sh/tab`
- **Packages:** `@securitylayerai/core`, `securitylayer` (cli), `@securitylayerai/proxy`, `@securitylayerai/sdk`, `@securitylayerai/adapters`, `@securitylayerai/rules`
- **Core philosophy:** Don't detect bad actions. Make them impossible.

## Translation Rules

When translating documentation, the following product-specific terms must NEVER be translated — keep them in English across all locales:

- **Product name:** Security Layer, SecurityLayer
- **Architecture terms:** capabilities, capability gate, taint, taint level, taint tracking, rules, rules engine, pipeline, security pipeline, normalization, security engine, LLM judge
- **Code identifiers:** All function names, type names, config keys stay as-is

Generic security concepts (e.g., "firewall rules", "security policy") should be translated normally.

## Commit Messages

- Do not include "Generated with" or co-authorship lines
