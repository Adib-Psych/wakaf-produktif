# Wakaf Produktif — current agent entry

Updated 7 November 2026. This compact entry supersedes the former May–June operating manual. History remains in Git; do not load it on every task.

## Start small

Read `CURRENT.md`, then only the source and tests needed for the named task. Do not automatically read the full Claude-era corpus, financial archives, unrelated project instructions or stale pending registers. Retrieve history only for a specific conflict. Facts must carry their source date; recent transport does not make old decisions current.

## Delivery

- Preserve and improve the existing dashboard, not rebuild it. Restore the original analytical hierarchy and ordinary operator controls.
- Roles (owner decision 9 Nov 2026, ADR-049; full text: Luna `Documents/Claude/Alat Claude/Mandat Kerja Claude dan Hermes 9Nov2026.md`):
  - **Claude** is the only party that changes the "recipe": architecture, code, formulas, Firestore rules, rulebooks, SOP/calendar content, data packages and QC. Code changes arrive as PRs on fresh `main`.
  - **Hermes (Thar Lay/server)** runs operations: posts owner-approved data packages through the supported writer with exact read-back, runs scheduled routines (backups, periodic wage reconciliation per ADR-048, health checks), merges Claude PRs whose required checks pass without editing their content, and files findings as GitHub Issues labelled `keluhan`. Hermes does not author code, rules, formulas, SOP content or presentation changes.
  - Reserved for the owner: payments, deletions, exposing personal data or worker names publicly, enabling billing/new costs, new business decisions.
- Query Luna/Mac over SSH/Tailscale only for evidence available there. Routine operation must not depend on the owner's laptop.
- Use fresh main, one integration owner, scoped edits/tests, branch and PR. Publish each tested coherent change promptly so Panji can inspect GitHub. Require applicable exact-head checks before merge and verify the Pages deployment/served bytes. Never push straight to main as an obsolete Mac workaround.
- API/CLI for administration; isolated server browser for UI evidence. Do not disturb the owner's browser or clear drafts/pending state. Owner hard-refresh is not the technical test plan.
- Match gates to the change: visual regression for CSS/date/navigation; source membership/filter/render/freshness for readers; validation/idempotency/ACK/rollback for writers and access policy. Whole-system certification is not a prerequisite for an unrelated safe patch.

## Current owner objective

During migration, make all relevant data live and readable and restore stable functionality without repeated email-login/access friction. Page-specific restrictions are a later design topic. The owner explicitly requested removal of barriers; do not revive an obsolete blanket pause. Separately resolve what unrestricted public read versus anonymous modification exposes before changing production policy. No credentials or signing capabilities belong in GitHub.

## Integrity and reporting

Do not fabricate data, receipts or readiness. Preserve original measurements, fund separation, corrections and pending reports. Opening entry is not authority to send payments or rewrite historical amounts. Report installed code, enabled capability and demonstrated operator outcome separately. Provide the actual inspection URL.

Current status: `CURRENT.md`; public progress: `status-pekerjaan.html`. Public content wording: load `CONTENT_GUIDELINES.md` only for the editorial task. Recovery/authority review: load the relevant procedure only when that boundary changes.
