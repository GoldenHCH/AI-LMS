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
- Supabase working copies have a fixed 30-minute lifetime measured from successful import. Reads
  reject expired rows immediately and a one-minute Cron job cascade-deletes the imported tree.
  Re-import writes the complete replacement before deleting the prior workspace copy.
- A signed, HttpOnly, Secure, SameSite=Strict cookie contains only an opaque workspace UUID and expiry.
  Server reads require the matching workspace ID; RLS is enabled and all course-table privileges
  are revoked from `anon` and `authenticated`, so browser roles cannot read or mutate content.
- The model stores only fields needed for round-trip course editing. It does not add device,
  location, analytics, advertising, or student-profile fields.
- Quiz answer keys stay inside the private working copy and reports from the fidelity probes list
  paths rather than copying course content.
- No AI/ML processing or model training occurs in this phase.

## Production and contractual gates

The application authorization and retention controls below are implemented. Production data flow
remains blocked until the external school/vendor gates are completed:

1. The application re-checks the chosen course against active teacher, TA, or designer
   enrollments before importing; a future persistent-account mode must require instructor MFA.
2. Execute the applicable school DPA and sub-processor review before real course data flows.
3. Confirm encrypted-at-rest storage, deletion-on-request operations, and retention evidence in
   the deployment environment.
4. Keep import and future export separate: no Canvas write may occur without an instructor's
   explicit preview and confirmation, and grading changes need per-quiz confirmation.

Direct-to-parent/homeschool use and student-facing use are not implemented. If either is added,
the consent/parental-access flows must be designed before collecting child data.
