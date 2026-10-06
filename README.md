# MCP 2026-07-28 Walkthrough

A one-change-per-page tutorial on Model Context Protocol specification revision 2026-07-28:
what changed, why, wire diagrams, colour-coded payloads, impact on existing servers, tests, and self-checks.

Every lesson has its own URL (`/mrtr/`) and every section an anchor (`/mrtr/#payloads`).

## Build

    node build.mjs      # writes dist/

No dependencies. Content lives in `src/lessons.js`; rendering in `src/render.js` (shared by the build and the browser).

## Deploy

    vercel --prod

## License

This repository is dual-licensed:

- **Code** (`build.mjs`, `api/`, `server/`, `src/app.js`, `src/render.js`, `src/helpers.js`, `src/style.css` and other source files): [MIT](LICENSE).
- **Course content** (lesson text, stories, diagrams, payload examples, quizzes and explanations, mainly in `src/lessons.js`, `src/core-lessons.js`, `src/extras.js` and `src/practice.js`, and the pages built from them): [CC BY 4.0](LICENSE-CONTENT).

Excerpts of the Model Context Protocol specification and other third-party material remain under their original licenses.
