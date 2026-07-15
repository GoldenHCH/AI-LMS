# Import-core compliance boundaries

This phase handles instructor-authored course pages, quiz definitions, answer keys, module
structure, and file metadata. It deliberately does **not** request or import enrollments,
student submissions, grades, attendance, analytics, profiles, or student identifiers.

## Controls implemented here

- OAuth uses a server-generated state value, constant-time state comparison, short-lived token
  exchange/refresh support, least-privilege read scopes, HTTPS-only Canvas origins, and sanitized
  errors. Tokens and client secrets are never serialized into a course working copy.
- Import calls only Canvas read methods. Unsupported content and partial failures are surfaced;
  they are not dropped or logged with full payloads.
- Working-copy documents have schema version, `created_at`, and `delete_after` metadata, default
  to 90-day retention, use atomic replacement, and are restricted to filesystem mode `0600`.
- The model stores only fields needed for round-trip course editing. It does not add device,
  location, analytics, advertising, or student-profile fields.
- Quiz answer keys stay inside the private working copy and reports from the fidelity probes list
  paths rather than copying course content.
- No AI/ML processing or model training occurs in this phase.

## Production host requirements

The Python package is a core library, not the authorization boundary. Before exposing import in
the application, the Next.js/Supabase host must:

1. Require an authenticated instructor/authorized school official and verify that Canvas grants
   that user access to the selected course for a legitimate educational purpose.
2. Store OAuth access/refresh tokens only in encrypted server-side credential storage; never in
   browser storage, logs, analytics, or the JSON working copy.
3. Store working copies on encrypted-at-rest infrastructure and run a verifiable hard-deletion
   job at `delete_after` (or sooner at contract termination/deletion request).
4. Apply row-level authorization so an instructor can access only their own imported courses.
5. Audit import/read/export actions using actor ID, course ID, purpose, timestamp, and outcome—
   never raw page HTML, quiz answers, access tokens, or unnecessary network identifiers.
6. Execute the applicable school DPA and sub-processor review before real course data flows.
7. Keep import and future export separate: no Canvas write may occur without an instructor's
   explicit preview and confirmation, and grading changes need per-quiz confirmation.

Direct-to-parent/homeschool use and student-facing use are not implemented. If either is added,
the consent/parental-access flows must be designed before collecting child data.
