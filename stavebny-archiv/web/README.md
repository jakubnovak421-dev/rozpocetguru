# Stavebný archív

Private Sites application for construction projects. Slovak mobile UI with the supplied Zakládání staveb logo. Vinext on Workers; D1 for projects, records, immutable revisions, operation receipts and settings; R2 for original JPEG/PNG/WebP/PDF bytes.

## Features

- Project list, project detail, record viewer/editor, settings.
- Uploads up to 20 MiB; protected previews and downloads.
- Separate original photos, blank template uploads, records and diary.
- Basic water-test/injection/general/diary records. These are **not transcriptions of the supplied paper forms**.
- Water flow calculated in the viewer from known volume and duration; unknown fields stay empty.
- Record revisions, optimistic version checks and atomic idempotency receipts shared by UI and MCP writes.
- Print layout uses browser Print / Save as PDF. It does not automatically archive a rendered PDF; saved structured records remain in D1.
- Optional blue handwriting-style values use device fonts.
- MCP tools: list/create projects, search/get/create/update records, list files, attach actual base64 file bytes (5 MiB maximum).

## Identity and access

Sites owns authentication and the owner-private audience. All data-bearing endpoints require dispatch-provided user ID and email. Every query is scoped to the user ID. Cross-origin requests with a mismatched Origin are rejected. Discovery contains no private data. No service bypass substitutes for a user identity. Changing audience does not grant access to another user's records.

File type signatures, supported media types, request sizes and input lengths are checked. Files are returned with no-store and nosniff headers. React escapes user text. File names are encoded in response headers. No server-side arbitrary URL fetching.

Original files are immutable and never overwritten. After an uncertain database failure, uploaded R2 bytes are retained to avoid deleting bytes referenced by a committed transaction; unreferenced objects may require later reconciliation. Records are revisioned; no delete function is exposed in version 1.

## Limits and unfinished integrations

Lists return at most the latest 500 records/files per query. No production data is seeded. Paper-form transcription and import of existing photos require verified project assignment. MCP hosting is separate from the user's plugin installation; verify an actual connected tool call after installation. Base64 upload requires the caller to have the real bytes and does not itself fetch chat attachments.

Browser QA was unavailable in the authoring environment. Core tests use real emulated D1/R2 bindings, not production records.

## Development

- `node node_modules/typescript/bin/tsc --noEmit`
- `node tests/archive.test.mjs` (isolated D1/R2, no user data)
- `node node_modules/drizzle-kit/bin.cjs generate` after schema edits.
- Build and publish with the Sites skill helpers; preserve `.openai/hosting.json` identity and private audience.

Generated SQL migrations, including Drizzle metadata, must be committed. No runtime schema creation.
