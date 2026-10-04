# Requirements Document

## Introduction

**Spill** is DivaCrew's anonymous incident reporting feature. It lets any user submit a community report about something they witnessed or experienced — a dangerous situation at a location, an unsafe encounter, or a concern they want to share with the community — without revealing their identity to anyone, including DivaCrew staff.

Spill is a community awareness tool, not a legal instrument. Every report is unverified. No report names individuals publicly. No report claims a place or person is safe. The system's only output is: a category label, a coarse area, a date, and the label "Community report — unverified". Descriptions are for moderator review only and never shown publicly.

True anonymity is the core guarantee of this feature. The system is architected so that even a full database breach or full staff access cannot link a submitted report to the person who submitted it. Anonymisation happens before any database write. No user ID, session ID, IP address, or device fingerprint is stored anywhere near the report.

This feature is marked **LATER** in the DivaCrew build order and MUST NOT be implemented without all of the following prerequisites being satisfied:

> ⚠️ **CRITICAL — DO NOT BUILD WITHOUT:**
> 1. **Legal review** of anonymous incident reporting under India's IT Act 2000, the Digital Personal Data Protection Act 2023 (DPDP Act), and any other applicable regulations.
> 2. **A staffed, trained moderation team** capable of reviewing every report before it is displayed publicly.
> 3. **A clear, published policy** on how reports about named or identifiable individuals are handled, including the review-request process.
> 4. **A written plan** for responding to law enforcement data requests, including what data exists, what does not exist (no reporter identity), and the legal basis for each response.

This spec depends on the **moderation** spec (moderation queue, audit log, Audit_Service, Resource_Service) and the **foundation-auth** spec (profiles, auth, RLS patterns).

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Spill_Service**: The server-side component in `/lib/spill` responsible for accepting, anonymising, validating, and persisting anonymous reports.
- **PII_Detector**: The server-side component in `/lib/security` that checks report text for phone numbers, name-like patterns, and other personal identifiers before persistence.
- **Image_Processor**: The server-side component in `/lib/security` that strips EXIF metadata, compresses, and stores uploaded photos to a private bucket using a non-identifying storage path.
- **Rate_Limiter**: The server-side component in `/lib/security` that enforces submission rate limits using a privacy-preserving, time-windowed counter without storing any user identifier.
- **Moderation_Queue**: The admin-only queue defined in the moderation spec; Spill reports enter this queue at status `pending_review`.
- **Spill_Moderator**: An authenticated user with a `moderator` or `platform_admin` platform role who reviews Spill reports in the Moderation_Queue.
- **Anonymous_Report**: A persisted report record that contains zero fields that could identify the submitter — no `user_id`, no `session_id`, no `ip_address`, no `device_id`, no identifying storage path.
- **Report_Category**: One of the enumerated incident categories a submitter selects when filing a report (see Requirement 1 for the full list).
- **Coarse_Area**: A neighbourhood, district, or locality name chosen by the submitter from a predefined list or a free-text area name — never precise GPS coordinates or a full address.
- **Public_Display_Record**: The read-only projection of an approved Anonymous_Report shown on the community feed: category label, Coarse_Area, approval date, and the label "Community report — unverified". No description text.
- **Review_Request**: A non-anonymous form submitted by a person who believes they are mentioned in a published report, routed to the moderation team. It does not link to the report submitter.
- **Short_Lived_Token**: A transient, session-derived value used only to compute the Rate_Limiter's time-windowed key; it is never persisted and is discarded after key derivation.
- **Expiry**: The state of an approved Anonymous_Report 30 days after its approval date, at which point it is removed from public display but retained in the database for legal hold.
- **Helpline_Resource**: A configurable record (name, phone number, URL, language, active flag) loaded by the Resource_Service for display in submission confirmations.
- **Audit_Service**: As defined in the moderation spec — writes immutable, PII-free audit log entries for all staff actions.

---

## Requirements

### Requirement 1: Anonymous Report Submission

**User Story:** As a DivaCrew user, I want to submit an anonymous report about something I witnessed or experienced, so that I can alert the community without revealing who I am.

#### Acceptance Criteria

1. THE App SHALL provide a "Spill" entry point accessible from the main navigation to any authenticated user.
2. WHEN a user begins a Spill submission, THE App SHALL display a prominent disclaimer: "This is a community report, not a police complaint. It will be reviewed before anyone sees it. Your identity is never stored." with a link to guidance on filing a police report.
3. THE App SHALL require the submitter to select exactly one Report_Category from this enumerated list: `unsafe_situation`, `suspicious_activity`, `harassment_witnessed`, `unsafe_infrastructure`, `unsafe_transport`, `other`.
4. THE App SHALL require the submitter to select or enter a Coarse_Area (neighbourhood, district, or locality); THE App SHALL NOT request, accept, or display precise GPS coordinates or a full street address.
5. THE App SHALL require the submitter to select an approximate incident time: one of `last_hour`, `today`, `yesterday`, `this_week`, `earlier`.
6. THE App SHALL provide a free-text description field with a maximum of 800 characters.
7. THE App SHALL provide an optional photo upload field accepting a single image file.
8. WHEN the submitter taps "Submit", THE Spill_Service SHALL validate all inputs with Zod before any further processing; invalid inputs SHALL be rejected with a field-level error message.
9. WHEN inputs pass Zod validation, THE Spill_Service SHALL pass the description text to the PII_Detector BEFORE writing any data to the database.
10. WHEN the PII_Detector flags possible personal identifiers in the description, THE Spill_Service SHALL set the report's `pii_flagged` field to `true` and route the report to the Moderation_Queue with a `pii_review` tag; THE Spill_Service SHALL log the detection event WITHOUT logging the matched text.
11. WHEN a photo is attached, THE Spill_Service SHALL pass the image to the Image_Processor BEFORE writing any data to the database; the processed image SHALL be stored in a private Supabase Storage bucket using a randomly generated UUID path that contains no user-identifying string.
12. WHEN all processing is complete, THE Spill_Service SHALL write the Anonymous_Report to the database with status `pending_review`; the record SHALL contain NO `user_id`, NO `session_id`, NO `ip_address`, NO `device_id`, and NO storage path segment derived from a user identifier.
13. WHEN the Anonymous_Report is persisted, THE App SHALL display the supportive confirmation screen defined in Requirement 5.

---

### Requirement 2: Zero-Identity Architecture

**User Story:** As a privacy-conscious submitter, I want the system to be architected so that it is technically impossible for anyone — including DivaCrew staff or a database attacker — to link my report to me, so that I can report safely.

#### Acceptance Criteria

1. THE Spill_Service SHALL strip all session context, authentication context, and request metadata (including IP address, User-Agent, and Referer headers) from the report record BEFORE any database write.
2. THE Anonymous_Report table SHALL contain no foreign key to the `profiles` table, no `user_id` column, no `session_id` column, no `ip_address` column, and no `device_id` column; the schema SHALL enforce this via column-level constraints.
3. THE Spill_Service SHALL generate a random UUID as the report's primary key; this UUID SHALL be derived from no user-identifying input.
4. THE Image_Processor SHALL strip all EXIF metadata (including GPS tags, device model, timestamp, and camera serial) from uploaded images BEFORE storing them; the processed image SHALL be stored under a randomly generated UUID path with no user-identifying segment.
5. THE Spill_Service SHALL NOT write any log entry that associates a report ID with a user ID, session ID, IP address, or any other user-identifying value — including at the application logging layer, the infrastructure layer (load balancer logs, CDN logs), or the Supabase audit log.
6. IF the Spill_Service is deployed behind a reverse proxy or CDN that logs IP addresses, THEN the deployment configuration SHALL disable IP logging for the Spill submission endpoint, OR the infrastructure logs for this endpoint SHALL be excluded from retention; this requirement SHALL be documented in the deployment checklist.
7. THE Rate_Limiter SHALL enforce submission rate limits WITHOUT storing any user identifier; it SHALL derive a time-windowed counter key from a Short_Lived_Token (a non-identifying value derived from the user's session), store only the counter and its expiry window, and discard the Short_Lived_Token immediately after key derivation.
8. THE Rate_Limiter's counter keys SHALL expire automatically after the rate-limit window (1 hour); no persistent record of the key SHALL survive beyond that window.
9. FOR ALL Anonymous_Report records in the database, a full read of the `anonymous_reports` table by any role (including `service_role`) SHALL return no column that can be joined to the `profiles` table or any user-session table.

---

### Requirement 3: PII Detection and Blocking

**User Story:** As a product owner, I want the system to detect and block names and phone numbers in report text before public display, so that individuals are never named in community-visible reports.

#### Acceptance Criteria

1. THE PII_Detector SHALL check every submitted description for Indian mobile phone number patterns: 10-digit numbers starting with 6, 7, 8, or 9; numbers prefixed with `+91`; and numbers prefixed with `0`.
2. THE PII_Detector SHALL check every submitted description for name-like patterns: sequences of two or more capitalised words not preceded by a location indicator.
3. WHEN the PII_Detector identifies a probable phone number or name-like pattern, THE Spill_Service SHALL set `pii_flagged = true` on the report and route the report to the Moderation_Queue with a `pii_review` tag.
4. THE PII_Detector SHALL log a detection event containing: report UUID, detection type (`phone_number` or `name_pattern`), and timestamp — but SHALL NOT log the matched text, the full description, or any text that could reconstruct the original input.
5. THE Spill_Service SHALL NOT auto-publish any report flagged by the PII_Detector; all such reports SHALL require explicit Spill_Moderator approval.
6. THE Spill_Service SHALL NOT auto-reject PII-flagged reports; moderators retain the decision to approve (if the detected text is not actually identifying) or reject.
7. THE App SHALL NOT display the description text in any public-facing view regardless of PII flag status; the description is accessible only to Spill_Moderators in the Moderation_Queue.
8. THE PII_Detector SHALL be implemented as a pure function in `/lib/security` with deterministic outputs for a given input string, enabling unit testing without side effects.

---

### Requirement 4: Moderation Review Step

**User Story:** As a Spill_Moderator, I want every submitted report to pass through a review step before it is publicly visible, so that I can approve, reject, or escalate reports appropriately.

#### Acceptance Criteria

1. WHEN an Anonymous_Report is created, its initial status SHALL be `pending_review`; no Anonymous_Report SHALL appear in any public-facing view while its status is `pending_review`.
2. THE Moderation_Queue (as defined in the moderation spec) SHALL display Spill reports under a "Spill" tab or filter, ordered by `created_at` ascending (oldest first).
3. WHEN a Spill_Moderator opens a Spill report in the queue, THE App SHALL display: category label, Coarse_Area, approximate incident time, description text, and (if present) the processed photo — and SHALL NOT display any reporter identity (because none exists).
4. THE App SHALL display a `pii_flagged` indicator prominently in the queue and in the report detail view when `pii_flagged = true`.
5. THE Spill_Moderator SHALL be able to take exactly three actions on a pending report:
   - `approve`: sets status to `approved`, makes the Public_Display_Record visible, records moderator hashed ID and timestamp via the Audit_Service.
   - `reject`: sets status to `rejected`, removes the report from public display permanently (it is retained in the database), records moderator hashed ID, action, and a required reason note via the Audit_Service.
   - `escalate`: sets status to `escalated`, routes the report to a senior review queue, records moderator hashed ID, action, and a required reason note via the Audit_Service.
6. WHEN a Spill_Moderator takes any action on a Spill report, THE Audit_Service SHALL write an audit log entry containing: moderator's hashed ID, action, report UUID (not linked to any user), content type `spill_report`, timestamp, and reason note (required for reject and escalate).
7. THE Moderation_Queue SHALL NOT display any column, field, or derived value that could be used to re-identify the submitter.
8. THE App SHALL display the total count of pending Spill reports as a badge in the moderation navigation, updating using Supabase Realtime.

---

### Requirement 5: Supportive Confirmation and Guidance

**User Story:** As a submitter, I want to see a warm, supportive confirmation after submitting a report, with helpline information and clear guidance that this is not a police report, so that I feel supported and understand the system's scope.

#### Acceptance Criteria

1. WHEN an Anonymous_Report is successfully persisted, THE App SHALL display a full-screen confirmation that is the only content visible to the submitter after submission.
2. THE confirmation SHALL include, in this order: (a) a warm supportive message in DivaCrew tone (e.g., "Thanks for looking out for the community 💛"), (b) a clear statement: "This is a community report, not a police complaint. It has been sent for review.", (c) a list of Helpline_Resources loaded by the Resource_Service, (d) guidance on how to file a police report (with the non-emergency number and a link to the relevant government guidance page, loaded from configuration), and (e) a "Done" button returning the user to the main feed.
3. THE Resource_Service SHALL load Helpline_Resources from a configurable data source (environment-backed configuration or a `spill_resources` table), NOT from hardcoded values in application code.
4. IF no active Helpline_Resources are configured, THEN THE App SHALL fall back to displaying the emergency services number (112) and the iCall helpline (9152987821) as hardcoded minimums.
5. THE confirmation screen SHALL NOT display the report's UUID or any reference that could be used to query the report's status.
6. THE App SHALL NOT send any notification, email, or in-app message to the submitter after submission; the confirmation screen is the only acknowledgement.
7. THE confirmation screen SHALL be accessible: keyboard navigable, readable by screen readers, minimum 16 px body text, and meeting WCAG 2.1 AA contrast in both light and dark themes.
8. THE confirmation screen SHALL include, in a visually distinct section: "Not sure how to file a police report? Here's how →" linking to a configurable URL (not hardcoded) pointing to official guidance.

---

### Requirement 6: Public Display of Approved Reports

**User Story:** As a community member, I want to see approved community reports for my area so that I can stay informed — with no verdicts, no names, and no claims of safety.

#### Acceptance Criteria

1. WHEN a Spill_Moderator approves an Anonymous_Report, THE App SHALL make a Public_Display_Record available on a community-facing Spill feed accessible to authenticated users.
2. THE Public_Display_Record SHALL contain exactly and only: category label, Coarse_Area, approval date (formatted as "Month YYYY" or "Day Month" — never a precise timestamp), and the fixed label "Community report — unverified".
3. THE App SHALL NOT display the description text, the photo, the approximate incident time, or any other field of the Anonymous_Report to any user in any public-facing view.
4. THE App SHALL NOT display any verdict, safety rating, or safety claim about any location, area, or individual in the Spill feed or in any Public_Display_Record.
5. THE App SHALL display the label "Community report — unverified" on every Public_Display_Record in a visually prominent position, using consistent styling across all display surfaces.
6. THE App SHALL display the Spill feed filtered to the user's selected area by default, with an option to view all areas.
7. WHILE an Anonymous_Report's `approved_at` timestamp is more than 30 days in the past, THE App SHALL exclude that record from all public-facing queries; the record SHALL remain in the database with status `expired`.
8. THE Spill_Service SHALL run a scheduled job that sets `status = 'expired'` on all Anonymous_Reports where `approved_at < now() - interval '30 days'` and `status = 'approved'`; this job SHALL NOT delete any rows.
9. THE App SHALL display the count of currently visible approved reports per area when browsing the Spill feed, with a label such as "3 community reports in the last 30 days".
10. WHEN there are no active Public_Display_Records for a selected area, THE App SHALL display: "No community reports for this area in the last 30 days." — and SHALL NOT display any statement implying the area is safe.

---

### Requirement 7: Report Expiry and Legal Hold

**User Story:** As a product owner, I want approved reports to disappear from public view after 30 days while being retained in the database, so that we meet both the community-awareness goal and any legal hold obligations.

#### Acceptance Criteria

1. THE Spill_Service SHALL set an `approved_at` timestamp on every Anonymous_Report when a Spill_Moderator approves it.
2. WHEN an Anonymous_Report's `approved_at` timestamp is 30 or more days in the past, THE Spill_Service's scheduled expiry job SHALL set `status = 'expired'` on that record.
3. THE App's public-facing queries for Spill reports SHALL filter on `status = 'approved'`, ensuring expired reports are automatically excluded without a separate deletion step.
4. THE Spill_Service SHALL NEVER delete rows from the `anonymous_reports` table via the scheduled expiry job; deletion SHALL require a separate, explicitly authorised administrative action with audit log entry.
5. THE App SHALL retain `rejected` and `escalated` reports in the database indefinitely under the same no-deletion rule; these records are never public but are retained for legal hold.
6. THE Audit_Service SHALL log every manual deletion of any Anonymous_Report row, recording the admin's hashed ID, the report UUID, and the timestamp.
7. THE `anonymous_reports` table SHALL include a `legal_hold` boolean column (default `false`); WHILE `legal_hold = true`, THE Spill_Service SHALL prevent the expiry job from setting `status = 'expired'` on that record, and SHALL prevent any deletion.

---

### Requirement 8: Privacy-Preserving Rate Limiting

**User Story:** As a product owner, I want rate limiting on Spill submissions that prevents abuse without storing any identifier linking a submission to a user, so that we stop spam without compromising anonymity.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a maximum of 3 Spill submissions per user per 1-hour sliding window.
2. THE Rate_Limiter SHALL derive its counter key from a Short_Lived_Token: a value computed as `HMAC-SHA256(session_token_prefix, current_hour_bucket)`, where `session_token_prefix` is a non-reversible truncation of the session token that does not uniquely identify the user across sessions.
3. THE Rate_Limiter SHALL store only the counter value and its expiry window (1 hour) keyed on the derived HMAC; it SHALL NOT store the Short_Lived_Token, the session token, any user ID, or any IP address.
4. THE Rate_Limiter's counter keys SHALL expire automatically at the end of the 1-hour window with no manual cleanup required.
5. WHEN a submission is rejected by the Rate_Limiter, THE App SHALL display a message: "You've submitted a few reports recently. Please wait a bit before submitting another." without indicating what the rate limit threshold is.
6. THE Rate_Limiter's counter storage SHALL be isolated from the `anonymous_reports` table and from any user-identity table; a join between the counter store and any other table SHALL NOT be possible by design.
7. IF the Rate_Limiter storage is unavailable, THEN THE Spill_Service SHALL allow the submission to proceed and SHALL log a service-availability alert without blocking the submitter.
8. THE Rate_Limiter SHALL be implemented so that it is impossible to reconstruct the submitter's identity from the counter key, even with full access to the counter store and the source code.

---

### Requirement 9: Review Request by Mentioned Individuals

**User Story:** As a person who believes they are named or identified in a published community report, I want a way to request a human review of that report, so that I can contest inaccurate or harmful content without creating a link to the original reporter.

#### Acceptance Criteria

1. THE App SHALL display a "Request a review" link on every Public_Display_Record in the Spill feed.
2. WHEN a user selects "Request a review", THE App SHALL display a form with: a plain-language explanation of what a review request is (not a removal guarantee), a required free-text field describing why they believe they are mentioned and why they think the report is inaccurate (maximum 1000 characters), an optional contact email field, and a "Submit" button.
3. THE App SHALL require the user to be authenticated to submit a Review_Request; the submitter's `profile_id` SHALL be recorded on the Review_Request for follow-up purposes.
4. THE App SHALL display a disclaimer on the Review_Request form: "Submitting this form does not reveal who filed the original report. We do not share your details with the reporter."
5. WHEN a Review_Request is submitted, THE Spill_Service SHALL create a `review_requests` record containing: the report UUID, the requesting user's `profile_id`, the description text, the optional contact email, and `created_at`; it SHALL NOT contain any reporter identity (because none exists).
6. THE `review_requests` record SHALL be routed to the Moderation_Queue as a separate item tagged `review_request`, NOT as a modification to the original Anonymous_Report.
7. WHEN a Spill_Moderator reviews a Review_Request alongside the original report, THE Moderation_Service SHALL present both items independently; the moderator's actions on one SHALL NOT automatically affect the other.
8. THE Audit_Service SHALL log every Spill_Moderator action on a Review_Request: moderator hashed ID, action, Review_Request ID, timestamp, and reason note.
9. IF a Review_Request results in a moderator decision to reject the original report, THEN THE Spill_Service SHALL set the original report's `status = 'rejected'` and remove it from public display.
10. THE App SHALL send an in-app notification to the Review_Request submitter when a decision has been made, stating only: "Your review request has been reviewed by our team." — without disclosing the moderator's decision reasoning.

---

### Requirement 10: RLS Policies for Spill Tables

**User Story:** As a developer, I want Row Level Security policies on all Spill tables so that no authenticated user can read another's report metadata, and so that no table join can re-identify a reporter.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on all tables introduced by this spec: `anonymous_reports`, `review_requests`, `spill_resources`.
2. THE App SHALL deny all SELECT, INSERT, UPDATE, and DELETE access on `anonymous_reports` to any authenticated non-moderator role; unauthenticated roles SHALL also be denied all access.
3. THE App SHALL allow only `moderator` and `platform_admin` roles to read rows in `anonymous_reports` via a server-side trusted function; direct client reads SHALL be blocked by RLS.
4. THE App SHALL allow all authenticated users to read approved, non-expired Public_Display_Record projections via a server-side trusted function or a Postgres view that returns only the four public fields (category, Coarse_Area, approval date, "unverified" label); the underlying `anonymous_reports` table SHALL remain inaccessible to non-moderator roles.
5. THE App SHALL allow authenticated users to INSERT into `review_requests` only via a trusted server-side function; direct client inserts SHALL be blocked by RLS.
6. THE App SHALL allow a user to read only their own rows in `review_requests`; moderators SHALL be able to read all rows.
7. THE App SHALL allow only `platform_admin` roles to INSERT, UPDATE, or DELETE rows in `spill_resources`; all authenticated users SHALL be able to read only `active = true` rows via a server-side function.
8. THE App SHALL enforce that no RLS policy on `anonymous_reports` permits a join condition referencing `auth.uid()`, `profiles.id`, or any session-derived value; the table's schema isolation (no user FK column) SHALL be validated by a migration test.
9. THE App SHALL deny all access to all Spill tables for unauthenticated requests.

---

### Requirement 11: Accessibility and Tone

**User Story:** As a DivaCrew user who may be a minor or in a distressing situation, I want the Spill submission flow to be warm, non-judgmental, and fully accessible, so that I feel safe using it regardless of my technical ability or device.

#### Acceptance Criteria

1. THE App SHALL render all Spill screens in DivaCrew tone: warm, supportive, Gen-Z friendly, non-condescending, and non-judgmental throughout.
2. THE App SHALL display a statement on the submission form, in plain language, that: (a) the user's identity is never stored, (b) the report will be reviewed before anyone sees it, and (c) this is not a police report.
3. THE App SHALL render all Spill screens with semantic HTML, keyboard navigation, and ARIA labels so that the flow is operable by screen reader users.
4. THE App SHALL meet WCAG 2.1 AA contrast requirements for all text and interactive elements in both light and dark themes.
5. THE App SHALL display all body text in the Spill flow at a minimum of 16 px.
6. THE App SHALL NOT use any language that implies a safety verdict about a location or person (e.g., "This area is unsafe", "This person is dangerous").
7. THE App SHALL NOT use any language that implies the report has been verified or that DivaCrew endorses its content.
8. THE App SHALL display the "Community report — unverified" label consistently across all surfaces where Spill content appears, in the same visual treatment.
9. WHEN the Spill submission flow is accessed on a mobile viewport (width < 768 px), THE App SHALL render all form elements with a minimum tap target size of 44 × 44 px.
10. THE App SHALL support the submission flow without requiring JavaScript for form rendering (progressive enhancement); client-side JavaScript SHALL be used only for validation feedback and photo preview.

---

### Requirement 12: PII Detection Tests

**User Story:** As a developer, I want automated tests verifying the PII detection logic, so that name and phone number detection is reliable and the no-logging guarantee is verifiable.

#### Acceptance Criteria

1. THE test suite SHALL include Vitest unit tests verifying that the PII_Detector flags each of the following Indian phone number formats: `9876543210`, `+919876543210`, `09876543210`.
2. THE test suite SHALL include Vitest unit tests verifying that the PII_Detector does NOT flag common non-PII numeric patterns: a 6-digit area PIN code, a 4-digit year, a price like `₹500`.
3. THE test suite SHALL include Vitest unit tests verifying that the PII_Detector flags text containing two or more adjacent title-cased words that are not preceded by location indicators (e.g., "Priya Sharma was there").
4. THE test suite SHALL include Vitest unit tests verifying that a description consisting entirely of non-identifying text returns `pii_flagged = false` and no detection log event.
5. THE test suite SHALL include a round-trip property: FOR ALL description strings containing at least one Indian phone number pattern, `pii_detector(description).flagged` SHALL be `true`; FOR ALL description strings containing no phone number or name pattern, `pii_detector(description).flagged` SHALL be `false` — tested with generated inputs covering edge cases (mixed language, emojis, partial numbers).
6. THE test suite SHALL include a Vitest unit test verifying that when the PII_Detector fires, the log event contains only `{ reportId, detectionType, timestamp }` and does NOT contain the matched text or the full description.

---

### Requirement 13: Zero-Identity Architecture Tests

**User Story:** As a developer, I want automated tests verifying the zero-identity guarantee, so that no code change can accidentally introduce a reporter-identifying field into the report record.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying that the object returned by the Spill_Service's `createReport` function, before database write, contains no `user_id`, `session_id`, `ip_address`, `device_id`, or `reporter_*` field.
2. THE test suite SHALL include a Vitest unit test verifying that the Image_Processor returns a storage path that matches the pattern `^spill/[0-9a-f-]{36}/[0-9a-f-]{36}\\.\\w+$` (two random UUIDs, no user-identifying segment).
3. THE test suite SHALL include a Vitest unit test verifying that the Image_Processor strips GPS EXIF tags from a test image containing known GPS metadata.
4. THE test suite SHALL include a round-trip property: FOR ALL valid Spill submission payloads (varying category, area, time, description), the persisted Anonymous_Report object SHALL contain none of the fields `user_id`, `session_id`, `ip_address`, `device_id`; this property SHALL be asserted over at least 50 generated payloads.
5. THE test suite SHALL include a Vitest unit test verifying that the Rate_Limiter's derived counter key for a given session token prefix and hour bucket is a fixed-length hex string that cannot be reversed to the session token prefix.
6. THE test suite SHALL include a Vitest unit test verifying that the `anonymous_reports` table schema (inspected via migration SQL) contains no column named `user_id`, `session_id`, `ip_address`, `device_id`, or any column with a foreign key referencing the `profiles` or `auth.users` table.
