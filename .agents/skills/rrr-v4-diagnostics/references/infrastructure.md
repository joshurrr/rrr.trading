# Infrastructure

Topic: `infrastructure`. Read the common workflow in [SKILL.md](../SKILL.md).

## Actual fields

- `S.evidence.cycle`: `availability`, `status`, `started_at`, `finished_at`,
  `duration_seconds`, `reasons`.
- `S.evidence.api_version`: `v4-admin-read-v1`, a response contract identifier.
- `S.sources.cycle`: `availability`, `timestamp`, `provenance`.
- `S.missing_evidence` includes `container_liveness_unknown`,
  `running_image_identity_unknown`, `storage_capacity_and_integrity_unknown`;
  it may also include `cycle_evidence_unavailable` or truncation/output gaps.

## Investigate

1. Compare saved cycle timestamps/availability with report generation time.
   Missing completion time or duration remains UNKNOWN. The API read timestamp
   cannot establish successful cycle completion or a functioning scheduler.
2. Preserve actual cycle reasons, such as `cycle_failed`, `cycle_locked`,
   `recording_failed`, `account_unavailable`, `operator_recovery_required`.
   They identify recorded symptoms, not a specific disk, container or network cause.
3. A readable JSON response does not verify storage capacity, database integrity,
   service liveness or deployed image identity. API version is not an image tag;
   local source, HTTP image and worker image may differ. Classify source-only
   conclusions SOURCE_CONFIRMED.
4. If a material gap blocks diagnosis, request a narrow existing sanitised status
   or bounded log excerpt for the relevant service and time. Do not request env
   dumps, Docker socket access, private config or complete logs. Follow applicable
   backend instructions for any separately authorised read-only inspection.

On this Windows/Unraid setup, do not attempt SSH or host Python, copy active
SQLite/WAL files, or treat NAS share permission errors as application/database
failure. No restart, repair, checkpoint, cleanup or deployment is authorised.
Recommend the smallest next evidence request when the cause remains UNKNOWN.
