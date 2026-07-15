# Import-core compliance boundaries

This phase handles instructor-authored course pages, quiz definitions, answer keys, module
structure, and file metadata. It deliberately does **not** request or import enrollments,
student submissions, grades, attendance, analytics, profiles, or student identifiers.

## Controls implemented here

- The active connect flow uses a transient Canvas PAT represented as a secret value. It is sent
  only through same-origin, body-limited requests to a service-token-protected sidecar and is
  never stored in browser storage, cookies, URLs, logs, analytics, audit events, or course rows.
- Canvas origins are HTTPS-only, root-path, default-port, non-local hosts restricted to hosted
  Instructure domains or an explicit exact-domain allowlist. Redirects and cross-origin
  pagination are rejected before a second request.
- Import calls only Canvas read methods. Unsupported content and partial failures are surfaced;
  they are not dropped or logged with full payloads.
- Supabase working copies default to 90-day retention. A daily Cron job hard-deletes expired
  courses and cascades through the imported tree; audit events have a three-year hard-delete
  deadline. Re-import writes the complete replacement before deleting the prior scratchpad.
- Course rows are owned by a Supabase Auth instructor. Read-only RLS follows the complete course
  hierarchy and requires both ownership and an `aal2` MFA claim. Browser roles have no direct
  mutation grant; the metadata-only audit table is server-only.
- The model stores only fields needed for round-trip course editing. It does not add device,
  location, analytics, advertising, or student-profile fields.
- Quiz answer keys stay inside the private working copy and reports from the fidelity probes list
  paths rather than copying course content.
- No AI/ML processing or model training occurs in this phase.

## Production and contractual gates

The application authorization and retention controls below are implemented. Production data flow
remains blocked until the external school/vendor gates are completed:

1. Invite only authorized instructors and require TOTP MFA; the application re-checks the chosen
   course against active teacher, TA, or designer enrollments before importing.
2. Execute the applicable school DPA and sub-processor review before real course data flows.
3. Confirm encrypted-at-rest storage, deletion-on-request operations, and retention evidence in
   the deployment environment.
4. Keep import and future export separate: no Canvas write may occur without an instructor's
   explicit preview and confirmation, and grading changes need per-quiz confirmation.

Direct-to-parent/homeschool use and student-facing use are not implemented. If either is added,
the consent/parental-access flows must be designed before collecting child data.
