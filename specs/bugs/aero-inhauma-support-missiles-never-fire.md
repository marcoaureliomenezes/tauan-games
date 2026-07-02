---
name: aero-inhauma-support-missiles-never-fire
context: tauan-games
release_id: v0.2.0
session_id: null
reported_at: "2026-07-01T03:07:51Z"
severity: medium
status: open
---

# Bug: Aero Fighters U-AC-8 support missiles never fire in Inhauma E2E

## Summary

The full Aero Fighters E2E suite fails the Inhauma uplift acceptance check
`U-AC-8: Inhauma tem helicópteros, comboio armado e aliados com guerra própria`.

## Reproduction

```bash
TEST_PORT=8119 npm run test:aero:e2e
```

Failing test:

```text
tests/aero-fighters/uplift.spec.js:186
```

The test reaches the support-war section and waits for:

```js
(window.game.flags.supportMissilesFired || 0) > 0
```

## Expected

After Inhauma takeoff in `testMode=1`, wingmen should engage their own
`game.allyEnemies`, fire at least one dedicated support missile, and increment
`window.game.flags.supportMissilesFired`.

## Actual

The wait times out on both the first run and retry. Full E2E result from the report:

```text
1 failed
  tests/aero-fighters/uplift.spec.js:186:1 › U-AC-8: Inhauma tem helicópteros, comboio armado e aliados com guerra própria
68 passed
```

Playwright failure artifacts were written under:

```text
tests/screenshots/aero-fighters-uplift-U-AC--6ee4b--aliados-com-guerra-própria/
tests/screenshots/aero-fighters-uplift-U-AC--6ee4b--aliados-com-guerra-própria-retry1/
```

## Notes

This was discovered while validating `T-GIS-06` road graph replacement. The failure is
not a road-continuity assertion: the preceding Inhauma road, traffic, airport, takeoff,
visual, and cross-map diagnostics checks passed in the same E2E run.

The documented bug workflow was attempted first, but this installed CLI does not expose
`dadaia lifecycle bug`:

```text
No such command 'bug'.
```

This file is therefore the additive fallback bug record required by the workspace bug
registration guardrail.
