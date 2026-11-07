# Musim Panen presentation — preservation and release scope

Owner selected the third visual direction (Musim Panen), authorized implementation and GitHub publication, and required compatibility with existing functions before release.

## Implementation boundary

Baseline: `72d62fca6291edff4f6fd8748026d97ce838e0af` (PR16, public-live reader). Executor/source: Thar Lay/server isolated checkout, branch `feat/harvest-presentation-20261107`. Output: reviewed GitHub source and Pages after publication. Luna/Mac was not read, altered or synchronized in this release.

Application changes are limited to `monitor-v2.html` presentation markup and one additional stylesheet, `recovery/harvest-presentation.css`. Existing inline scripts, external script order, IDs, static options, event attributes and control semantics remain unchanged. No reader, Auth, queue, cache, service worker, backend configuration, Rules, schema or arithmetic changes. No business records or grants created.

The approved concept is visual direction, not an alternative data model. Its illustrative totals, sample charts, example period switches and inert example controls are NOT installed. Existing dashboard metrics and all original task destinations retain their actual meanings and sources. Header freshness and source errors remain visible. Reading stays public; Google plus an enabled approved grant is still required for entry.

## Visual changes mapped to actual functions

- Plum / coffee / clay navigation and shared card, table and form treatment; semantic warning/grade colors remain distinct.
- Compact harvest introduction: **Petik → sortir → olah**. Each stage has its own weight record; these are not interchangeable weights.
- Existing `dash-panen-summary` is emphasized, using the original renderer, six metrics and tree table. No new yield or revenue calculation.
- Harvest intake, five-way sorting, pipeline, batch tracker, lots, sampling and benchmark modules remain in their existing order. The entry form uses shared grid spans and readable control sizes; no serialized field labels are renamed.
- Daily report identity/category templates, rainfall, login card, log filters and proportional table columns retain original hooks. The full set of 21 navigation destinations remains reachable.

## Verification before publication

- 347 Node regressions passed, no failures or skips (includes five new preservation tests).
- All eight existing script blocks byte-identical; 442 original IDs retain order, 462 original control tags and 219 inline event hooks unchanged.
- Same-fixture synthetic comparison: populated and partially unavailable sources at 1600/390px; all 21 route round-trips, 22 generated category templates, controls/options, source state, Chart.js data, real report CSV and selected-wage CSV unchanged. No backend or durable browser writes.
- Raw strict comparison deliberately retains 22 presentation differences. Exact disposition: approved introduction text added to Dashboard, and border/padding removed around an already-empty harvest KPI wrapper. No populated KPI content removed; source and export comparisons are identical. Final assets had no drift during replay.
- Populated candidate read-only scan: 21 panels × 1710/1280/390px = 63 states, no runtime error or document overflow. Table-contained scrolling is retained.
- Additional public-read/keyboard/focus/hidden-state acceptance at 1710/1280/1200/1199/880/879/768/600/390/360px passed. Public records visible; hidden sign-out remains hidden; keyboard entry navigation works. No write endpoint attempted.
- Public/Google Rules emulator and existing containment emulator passed with unchanged Rules. Offline worker upgrade/rollback tests and SDK-unavailable containment tests passed; these do not constitute a genuine staff submission.

Detailed evidence stays outside the published source tree on Thar Lay/server under `/root/.hermes/outputs/wakaf-harvest-release-20261107/`, including the function inventory, control inventory, strict raw comparison, explicitly dispositioned comparison, screenshots and runtime scan.

## Deliberate limits

Historical season/countdown labels, numerical formatting, targets and existing calculations are unchanged rather than silently repaired inside a design release. Original Safari/Chrome acceptance and genuine staff report → server ACK → reload → shared-reader acceptance remain outstanding. No synthetic production submission is used to claim them. Embedded document wrappers/routes are tested, not every inner document action. Installed bytes and live acceptance are verified separately after protected PR merge; this file alone is not deployment proof.

Application / preview: https://adib-psych.github.io/wakaf-produktif/monitor-v2.html
