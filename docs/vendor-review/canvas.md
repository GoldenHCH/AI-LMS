# Canvas integration vendor / data-flow review

Owner: pending

Status: **development only; production data flow is blocked until contractual and tenant-specific
items below are completed.**

| Check | Status | Notes |
| --- | --- | --- |
| DPA / school authorization signed | Pending | Required before importing real institutional course data. |
| Institution has enabled an appropriate developer key | Pending per tenant | Canvas OAuth developer keys are controlled by the institution/root account or Instructure. |
| Data residency documented | Pending per tenant | Canvas deployment and the application storage region must be recorded. |
| COPPA / FERPA roles documented | Pending contract | This phase is instructor-facing and imports no student records, but course content may still be confidential. |
| Deletion on request supported | Application design complete | Working copies have `delete_after`; the production deletion worker and certificate process remain host work. |
| Breach notification SLA | Pending contract | Use the most restrictive applicable school/state term. |
| Sub-processor list available | Pending | Record Canvas/Instructure and application infrastructure disclosures. |

## Data exchanged

- From Canvas: course/module/item IDs and order; instructor-authored page HTML; quiz definitions,
  questions, answer options, answer keys, points; file metadata and URLs.
- To Canvas during this phase: OAuth protocol requests and read-only API calls. The isolated
  fidelity spike can write to a deliberately selected test quiz only after explicit CLI
  confirmation; it is not an application flow.
- Explicitly excluded: student rosters, profiles, submissions, grades, attendance, analytics,
  and behavioral identifiers.

## Security configuration

- TLS/HTTPS is mandatory for Canvas origins.
- Use least-privilege scoped OAuth tokens and encrypted server-side token storage.
- Never put Canvas tokens or raw course content in logs or third-party analytics.
- Run live probes only in an unpublished, isolated course with no student submissions.
