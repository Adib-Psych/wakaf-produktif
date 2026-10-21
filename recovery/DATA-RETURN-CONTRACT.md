# Data-return handoff — read-only structural gate

Owner: semantic/data-review agent owns its immutable evidence and business conclusions. Thar Lay/server owns application validation only. No data-review files are read, edited or copied by this implementation. This document is a proposed exact machine handoff, not acceptance of real data or authority to import it.

Required three files: contract.json, manifest.json, records.json (UTF-8). No credentials, capability IDs, browser exports or evidence attachments are needed in an owner-safe report. Keep the actual handoff private on its approved host.

contract.json version1 declares id; exact source.project/database; collections map. Each collection has required:boolean, required_fields:{field:FirestoreTypeTag}, units:{field-or-array-path:unit}, row_array:null or {path:[...],id_field:string,required_fields:{...}}, links:[{field,collection}]. Every business field must be declared. Keys not declared are issues; do not silently drop them. Units kg/g/trees are checked for nonnegative measurements; other units remain literal and must be reviewed. No currency conversion, unit conversion, chronological reconstruction or default zero is performed. Finance and K1–K3/K4 allocation semantics remain data-review gates, not automatic structural approval.

manifest.json has exactly: version:1; schema:"wakaf-typed-return-v1"; synthetic:boolean; source; cutoff/capture_start/capture_end offset-aware ISO times; contract_sha256 (sorted-key compact ensure_ascii JSON); records_sha256 (exact records.json bytes); collections:{name:{captured:boolean,documents:int,rows:int}}; units:{"collection/path":unit}; historical_union:false. Missing capture is not zero. Filename is not identity, freshness or approval. Historical merge/union is refused. Record membership/hash changes require a new explicit manifest, never auto-repair.

records.json is a list of exact {name,fields} documents. Name is projects/PROJECT/databases/DATABASE/documents/COLLECTION/ID. Fields preserve original Firestore type tags. Arrays preserve order; absent/null/zero remain distinct. Duplicate JSON keys, duplicate documents/row identities, unsafe browser integer, invalid calendar, non-finite number, foreign path, unexpected fields/collections, missing linked target and declared-count mismatch are rejected with pointers. Existing source records are never rewritten. Row dates are checked against the declared cutoff. Live application models may need additional domain-specific schema/semantic rules; adding a declared field is not business approval.

Run from repository root:

    python3 -B recovery/data_return.py --contract CONTRACT --manifest MANIFEST --records RECORDS

Optional baseline comparison requires both --baseline-manifest and --baseline-records. Deletions, replacements and shrinkage become explicit HOLD issues; there is no union, reconciliation or apply mode. The command prints JSON and writes nothing. Exit0 is structural agreement only, not permission to restore or financial acceptance.

Synthetic-only rehearsal (real source normalization/calculation/export functions, ephemeral VM):

    python3 -B recovery/stage_data_return.py --contract CONTRACT --manifest MANIFEST --records RECORDS --source /absolute/source

This route refuses synthetic:false and projects not beginning demo-. It does not connect to Firestore, import data, change current dashboard storage, or publish HTML. The browser acceptance runner additionally uses the actual dashboard DOM/renderLog and CSV download with explicitly synthetic rows, nonempty synthetic finance sentinels and unchanged pending. VM projection is not the whole browser journey or genuine provider acceptance.

For the review agent: preserve your final data/proof bytes; prepare the exact three-file contract only when authorized to hand it over. Run preflight against a copy; retain emitted issues and source hashes. Do not fix an issue by guessing an amount/date/unit, merging captures or dropping records. Return a new reviewed manifest only after the relevant semantic decision. Current examples are synthetic, not a template granting financial approval.

Cabut remains held for shared-aggregate activation. recovery/cabut_preflight.py provides a working nonmutating expected-revision + event proposal. No executable shared-array replace is supplied; a future reviewed server transaction must bind predecessor revision, absent event/report and immutable receipt. Reopening, production import, Rules/IAM/provider/grants, payment and actual recovery are separate authorizations.

Review corrections: contract root/collection/row/link exact shapes and actual booleans are required. Timestamp tags require RFC3339 with timezone and up to9 fractional digits; bytes require valid base64; every reference (including nested references) must resolve to an included source-project document. A self-supplied contract and checksum are not an independent trust anchor. The gate does not certify nested map business vocabulary, fund allocation or real-data semantic approval; the data-review agent/owner must lock the exact reviewed contract hash and included scope before any later actual-data handoff. No import mode is supplied.
