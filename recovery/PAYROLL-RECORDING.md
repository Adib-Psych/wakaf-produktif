# Authorized field payroll recording

Records an operator's attestation that a wage was actually paid; does not transfer money. Existing verified Google report identity and exact entry grant remain required. Payroll uses a separate revocable UID grant. Public reading remains independent of login.

## Bounded activation

Provision server-side payroll_policy/active `{enabled:true,epoch:1}`, payroll_grants keyed approved UID `{uid,enabled:true,epoch:1}`, and payroll_targets keyed exact wage ID `{enabled:true,wage:originalSource}`. Never add fields to existing six-field entry grants. Before provisioning targets, reread original wages, entitlements/processing/bindings, cashbook and advances. Attest unique source, no unresolved processing, no prior linked/aggregate payment and no outstanding advance; preserve each source's original fund. K4 work and actual payments are recorded in the same workflow with source `pribadi`, backend-bound to exact K4 wage provenance; the derived private cash is displayed separately and excluded from Wakaf cash, balance, RAB and Wakaf-only exports. Non-K4 uses source `wakif`; Anto source remains held. Targets are not permission to create wages.

The initial activation is limited to eleven existing verified Wakaf unpaid entitlements. Future wages need separately reviewed targets. Original paid history cannot be cancelled through this protocol. Corrections affect only new recorded payments and require a reason. Operators enter actual payment dates; nothing marks wages paid during commissioning.

## Persistence and readers

One transaction updates payroll_states and creates an identical immutable payroll_events record. Expected revision and predecessor prevent silent stale writes. Lost ACK uses an account-bound durable event identity; uncertain intent cannot silently change or move to another account. Existing upah, cashbook and entitlement documents remain immutable to browser clients. Public reader joins paired state/events to original wages and derives one deterministic cash row, or removes only that derived row after an audited correction. Missing/stale coupled sources retain the last coherent wage/cash projection with stale status.

This read projection is required for payroll-aware reporting: original legacy singleton cashbook alone does not contain new derived rows. Do not let an old privileged writer copy a projected array into a base singleton. Revoke/reconcile targets before privileged cash, wage or advance edits. This is not an automatic wage-generation release.

## Verification

`node --test tests/*.test.cjs operations/tests/*.test.cjs recovery/payroll-*.test.mjs recovery/payroll-reader-behavior.test.cjs`

`node recovery/payroll.rules.test.cjs`

`node recovery/payroll-client-run.cjs`

`node tests/rules-public-run.cjs`

`CHROME_PATH=... node recovery/payroll-ui.browser.cjs`

Emulator and fixture tests do not prove actual operator acceptance. Never fabricate a production payment as a test. Publication and activation require exact served-file and deployed Rules readback.
