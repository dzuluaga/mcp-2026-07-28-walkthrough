# MCP 2026-07-28 Walkthrough

A one-change-per-page tutorial on Model Context Protocol specification revision 2026-07-28:
what changed, why, wire diagrams, colour-coded payloads, impact on existing servers, tests, and self-checks.

Every lesson has its own URL (`/mrtr/`) and every section an anchor (`/mrtr/#payloads`).

## Build

    node build.mjs      # writes dist/

No dependencies. Content lives in `src/lessons.js`; rendering in `src/render.js` (shared by the build and the browser).

## Deploy

    vercel --prod
