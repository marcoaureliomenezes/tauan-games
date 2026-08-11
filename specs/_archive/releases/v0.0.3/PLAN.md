# PLAN: Testing Infrastructure — Playwright Quality Gates

> **Status:** [x] Approved
> **SPEC:** `specs/features/testing-infra/SPEC.md` [x] Approved
> **Created:** 2026-05-09

---

## Context

Before any game code is written, the test harness must be in place. The tests are written against the `window.game` contract defined in the spec — they will fail until the game is implemented, but the test *files* must exist so each game task can verify its own AC on completion.

**Dependency order:** testing-infra → tauan-trex implementation → aero-fighters implementation.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| `package.json` at repo root | Playwright is transversal tooling, not game code. One install covers all games. |
| `python3 -m http.server` as static server | Zero dependencies; available everywhere; simpler than `npx serve` which needs npm network access |
| Port 8080 | Standard local dev port; unlikely to conflict; hardcoded in `playwright.config.js` for simplicity |
| Chromium only (no Firefox/WebKit) | Both games target a single player (Tauan) on a desktop browser. Cross-browser parity is not a requirement. |
| Tests in `tests/<game>/smoke.spec.js` | One file per game; clear ownership; easy to run a single game's suite in isolation |

---

## Implementation Phases

### Phase 1 — npm + Playwright install (T01–T02)
Create `package.json`, run `npm install`, install Chromium browser binary.

### Phase 2 — Static server setup (T03–T04)
`globalSetup.js` starts `python3 -m http.server 8080` from the repo root.
`globalTeardown.js` kills the server process after tests complete.

### Phase 3 — Playwright config (T05)
`playwright.config.js` wires baseURL, browser, globalSetup/Teardown, screenshot dir, and timeout values.

### Phase 4 — Test files (T06–T07)
Write smoke test files for both games. Tests will fail at this stage (games don't exist yet) — that is expected and correct.

---

## Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Port 8080 already in use | `globalSetup.js` checks port availability and fails fast with a clear message |
| `python3` not available | Fallback to `npx serve`; document in README |
| CDN unavailable during tests | Games must cache CDN scripts locally for offline testing (noted in game PLANs) |

---

## Verification

```bash
cd /home/ubuntu/workspace/repos/tauan-games
npm test -- --list          # lists test files, exits 0
npx playwright test tests/trex/smoke.spec.js --reporter=list   # shows 8 tests (all fail — games not built yet)
npx playwright test tests/aero-fighters/smoke.spec.js --reporter=list  # idem
```

Tests failing at this stage is the expected state. Green suite requires game implementation.

---

## Approval

- [x] Draft reviewed by operator
- [x] **Status:** [x] Approved — 2026-05-09
