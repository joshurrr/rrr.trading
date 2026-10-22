# Website and APIs

Topic: `website`. Read the common workflow in [SKILL.md](../SKILL.md).

## Actual fields and interface

- `S.evidence.admin_response`: `GENERATED` when this report was generated.
- `S.evidence.api_version`: `v4-admin-read-v1`.
- `S.sources.cycle`: `availability`, `timestamp`, `provenance`.
- This topic currently returns `S.status=UNKNOWN`; its gaps include
  `frontend_backend_discrepancy_not_measured` and
  `external_access_policy_not_verified`. A generated response does not establish
  frontend health or Access protection.
- The private Admin's Settings & logs section has Detailed Diagnostics below
  Cycle Diagnostics. Selecting one topic calls `/v4/admin?topic=<topic>`;
  **Refresh Topic** requests another read. Section/topic switching reuses loaded
  reports. **Copy Topic Diagnostics** copies the exact response text. The older
  **Copy Diagnostic Report** is a cycle summary, not a topic report.

## Investigate

1. Obtain the report for the affected topic and compare its `served_at`, source
   timestamps, `selected_topic` and `report_format` with the displayed report.
   Cached UI evidence is not automatically updated; request one manual refresh
   only when needed. Do not silently compare reports from different cycles.
2. Treat login redirects, HTML, 401/403, timeouts or inaccessible endpoints as
   access/evidence limitations. Stop repeated access attempts; ask the user for
   Copy Topic Diagnostics JSON. Never request session cookies or credentials.
3. HTTP 400 can return `error=unsupported_diagnostic_topic` with
   `supported_topics`; it is not a worker failure. HTTP 404, an older aggregate
   response, or missing topic fields may indicate unavailable deployment support;
   report the observed response rather than asserting a deployment mismatch.
   HTTP 5xx does not identify a backend root cause without recorded evidence.
4. If the UI conflicts with JSON, compare the same topic and read timestamp.
   Quote the specific fields and UI discrepancy; use the corresponding topic
   module for engine claims. A source change alone does not prove deployment.
5. For copy failures, use the selected topic's Technical details JSON manually.
   Preserve the original response, units, precision and codes; do not rewrite
   evidence or insert inferred explanations into the JSON. Never copy raw error
   pages or unsanitised private files as a substitute.

Recommend the smallest justified UI/access correction; do not alter Access,
frontend assets, API routes, configuration or deployment during diagnosis.
