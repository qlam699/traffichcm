<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project memory

- Read `.agent/AGENT_MEMORY.md` first: it summarizes architecture, file map, security rules, gotchas, and deploy. Avoid re-scanning every file.
- After finishing each task the user assigns, ASK the user whether to save anything to memory. If yes, update `.agent/AGENT_MEMORY.md` (relevant section + a dated line in section 8).
