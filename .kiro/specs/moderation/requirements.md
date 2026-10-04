# Requirements Document

## Introduction

The Moderation system is DivaCrew's trust and safety backbone. It covers every layer of protection for a women-only app whose audience includes minors (16–17) in India: a unified report flow across all content types, user-level block and mute controls, an admin moderation queue with severity-ordered triage, a strike system with consequences for inviters, crew-level admin tools, self-harm concern handling, a comprehensive audit log, and a plain-language community rules page.

This spec formalises the complete report-and-moderation pipeline that **foundation-auth** (profiles, blocks, invite system), **crews** (crew admin roles, mutes, removals), **feed-posts** (Report records), **fit-check**, **event-groups**, and **crew-checkin** all depend on. It does not re-define those tables; it extends them with the full moderation lifecycle, severity classification, and staff-access audit trail.

Minors receive stricter defaults throughout. No PII is ever logged in plain text. Resource data (crisis helplines, URLs) is configurable, not hardcoded.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Report_Service**: The server-side component in `/lib/moderation` responsible for creating, validating, and routing all reports.
- **Moderation_Service**: The server-side component in `/lib/moderation` responsible for the moderation queue, severity ordering, and applying moderation actions (dismiss, remove, warn, suspend, ban).
- **Strike_Service**: The server-side component in `/lib/moderation` that manages the per-profile strike ledger and propagates consequences to inviters.
- **Audit_Service**: The server-side component in `/lib/security` that writes an immutable log entry for every moderation action and every staff read of a sensitive table.
- **Block_Service**: The server-side component (extending foundation-auth) that enforces bi-directional invisibility between a blocking user and a blocked user.
- **Crew_Mod_Service**: The server-side component in `/lib/crews` that exposes crew-admin-specific moderation tools (remove post, timed mute, remove member, escalate to platform).
- **Resource_Service**: The server-side component in `/lib/moderation` that reads configurable crisis resource data (helplines, URLs) from environment-backed configuration.
- **Report**: A flag raised by an authenticated user against a piece of content or a profile, containing a `reason` category and an optional free-text note.
- **Report_Reason**: One of the eight enumerated categories: `harassment`, `doxxing`, `non_consensual_photos`, `hate`, `spam`, `fake_account`, `self_harm_concern`, `other`.
- **Severity_Level**: The triage priority assigned to a report based on its `reason`: `CRITICAL` (self_harm_concern, non_consensual_photos), `HIGH` (doxxing, hate), `MEDIUM` (harassment), `LOW` (spam, fake_account, other).
- **Reportable_Content**: Any piece of user-generated content that can be reported: a feed post, a comment, a direct message, a crew post, a crew, or a user profile.
- **Moderation_Queue**: The admin-only paginated list of open reports ordered by Severity_Level descending, then by `created_at` ascending within each severity tier.
- **Moderation_Action**: One of five actions a moderator may apply to a report: `dismiss`, `remove_content`, `warn`, `suspend`, `ban`.
- **Strike**: A demerit recorded on a Profile. Strikes accumulate: 1 strike → warning, 2 strikes → temporary suspension, 3 strikes → permanent ban.
- **Inviter**: The verified member whose Invite_Code was redeemed by a now-reported or now-banned user, as recorded via `inviter_id` on the invitee's Profile (foundation-auth).
- **Crew_Admin**: A Crew_Member with role `admin` or `owner` as defined in the crews spec.
- **Audit_Log**: An append-only table recording every moderation action and every staff read of a sensitive table, containing: `actor_id` (hashed), `action`, `target_id` (hashed), `content_type`, `timestamp`, `reason`. No PII in plain text.
- **Self_Harm_Resource**: A configurable record containing a helpline name, phone number, and URL shown to reporters who select the `self_harm_concern` reason.
- **Minor**: A user whose `age_bracket` is `minor` (under 18) as defined in foundation-auth.
- **SLA**: The target time-to-first-review for a report at each severity tier: CRITICAL ≤ 1 hour, HIGH ≤ 4 hours, MEDIUM ≤ 24 hours, LOW ≤ 72 hours.
- **Profile**: A row in the `profiles` table as defined in foundation-auth.
- **Rules_Page**: The in-app plain-language community standards page accessible from Settings and the sign-up flow.

---

## Requirements

### Requirement 1: Report Flow — Universal Report Button

**User Story:** As a user, I want a report button on every post, comment, message, crew, and profile I can see, so that I can flag harmful content or behaviour from anywhere in the app.

#### Acceptance Criteria

1. THE App SHALL display a report affordance (accessible via a "⋮" menu or long-press) on every piece of Reportable_Content visible to an authenticated user: feed posts, feed comments, crew posts, crew comments, direct messages, crews (as entities), and user profiles.
2. THE App SHALL NOT display the report affordance on the authenticated user's own content or profile.
3. WHEN a user selects "Report" on any Reportable_Content, THE App SHALL present a reason-selection screen listing all eight Report_Reason categories in this display order: harassment, non-consensual photos, doxxing, hate, self-harm concern, spam, fake account, other.
4. WHEN a user selects a Report_Reason, THE App SHALL display a brief, plain-language description of what that category covers, so the reporter can confirm their choice.
5. THE App SHALL display an optional free-text note field (maximum 500 characters) after the reporter selects a reason, allowing additional context.
6. WHEN a user submits a report, THE Report_Service SHALL create a Report record containing: `reporter_id`, `reported_content_id`, `content_type`, `reason`, `note` (nullable), `severity` (derived from reason), `status` (default `open`), and `created_at`.
7. THE Report_Service SHALL derive the `severity` field from the `reason` at creation time using the Severity_Level mapping: `self_harm_concern` and `non_consensual_photos` → `CRITICAL`; `doxxing` and `hate` → `HIGH`; `harassment` → `MEDIUM`; `spam`, `fake_account`, and `other` → `LOW`.
8. WHEN a report is successfully submitted, THE App SHALL display a confirmation in DivaCrew tone: "We got it — thanks for looking out 💛. We'll review this and take action if it breaks our rules."
9. THE Report_Service SHALL validate all report inputs with Zod before any database write; invalid inputs SHALL be rejected with a descriptive error.
10. THE App SHALL NOT allow a user to submit more than 20 reports per 24-hour window; attempts beyond this limit SHALL return a rate-limit error.
11. WHERE a user's `age_bracket` is `minor`, THE Report_Service SHALL flag the report with a `reporter_is_minor` boolean to allow moderators to apply additional sensitivity.

---

### Requirement 2: Self-Harm Concern — Immediate Reporter Support

**User Story:** As a user who has seen potentially self-harm-related content, I want the app to immediately show me supportive resources when I report it, so that I feel supported and know help is available.

#### Acceptance Criteria

1. WHEN a user selects `self_harm_concern` as their Report_Reason (before submitting the report), THE App SHALL immediately display a full-screen supportive overlay to the REPORTER containing: a warm supportive message, a list of Self_Harm_Resources (helpline names, phone numbers, URLs), and a button to continue with the report.
2. THE App SHALL display the supportive overlay to the reporter regardless of whether they ultimately submit the report.
3. THE Resource_Service SHALL load Self_Harm_Resources from a configurable data source (environment-backed configuration or a `crisis_resources` table), NOT from hardcoded values in application code.
4. THE Resource_Service SHALL support at least the following configurable fields per resource: `name`, `phone_number`, `url`, `language`, `active` (boolean to enable/disable without deployment).
5. WHEN the self-harm concern overlay is shown, THE App SHALL display a statement such as: "If you or someone you know needs support, you're not alone 💛" followed by the resource list.
6. THE App SHALL display the emergency services number (112) prominently in the self-harm concern overlay alongside any configured helplines.
7. THE App SHALL NOT notify the reported user that a self_harm_concern report has been made against their content; the report routes silently to the Moderation_Queue.
8. THE App SHALL display the self-harm concern overlay as an accessible modal that is keyboard navigable and readable by screen readers.
9. IF no active Self_Harm_Resources are configured, THEN THE App SHALL fall back to displaying only the emergency services number (112) and the iCall helpline (9152987821) as hardcoded minimums.

---

### Requirement 3: Block and Mute — User-Level Controls

**User Story:** As a user, I want to block or mute any other user, so that I can control who can see and interact with my content and whose content I see.

#### Acceptance Criteria

1. THE App SHALL display "Block [nickname]" and "Mute [nickname]" options in the context menu on every user profile and in the report flow's follow-up step.
2. WHEN a user blocks another user, THE Block_Service SHALL create a block record in the `blocks` table (as defined in foundation-auth) and THE App SHALL immediately hide all content from the blocked user across every surface: feed, crews, fit check, events, check-ins, messages, and search.
3. WHILE a block record exists between user A and user B, THE Block_Service SHALL enforce bi-directional invisibility: user B's content SHALL NOT appear to user A, and user A's content SHALL NOT appear to user B, without either user being notified of the block.
4. WHILE a block record exists, THE App SHALL prevent the blocked user from sending direct messages to the blocking user, from reacting to or commenting on the blocking user's content, and from viewing the blocking user's profile.
5. WHEN a user mutes another user, THE App SHALL create a mute record and THE App SHALL hide the muted user's content from the muting user's feed and crews surfaces; the muted user retains the ability to interact with the muting user's content.
6. WHEN a user unmutes a previously muted user, THE App SHALL delete the mute record and restore the muted user's content to the unmuting user's feeds.
7. THE App SHALL display a "Blocked users" list and a "Muted users" list in Settings, each showing the affected user's nickname and an option to unblock or unmute.
8. THE Block_Service SHALL enforce RLS so that block and mute records are only readable by the user who created them; no other user (including staff) SHALL be able to read the plain-text block list of another user.
9. WHERE a user's `age_bracket` is `minor`, THE App SHALL set a stricter default: new accounts from Minors SHALL have the block-unknown-users setting enabled by default until explicitly changed.

---

### Requirement 4: Moderation Queue — Admin Interface

**User Story:** As a platform moderator, I want a severity-ordered queue of open reports in an admin-only area, so that I can triage and act on the most serious reports first without missing anything.

#### Acceptance Criteria

1. THE App SHALL provide a Moderation_Queue page at `/admin/moderation` accessible only to authenticated users with a `moderator` or `admin` platform role; all other access attempts SHALL return a 403 response.
2. THE Moderation_Service SHALL return reports in the Moderation_Queue ordered by `severity` descending (CRITICAL first, then HIGH, MEDIUM, LOW) and by `created_at` ascending within each severity tier (oldest first).
3. THE App SHALL visually distinguish severity levels in the queue using colour coding: CRITICAL in red, HIGH in orange, MEDIUM in amber, LOW in grey — consistent with DivaCrew's brand palette.
4. WHEN a moderator opens a report in the queue, THE App SHALL display: the report reason, severity, submitted timestamp, reporter's anonymised identifier, the reported content (or a placeholder if already removed), and the reported user's anonymised profile summary.
5. THE App SHALL NOT display the reporter's real name, phone number, or any PII in the moderation queue; only anonymised identifiers SHALL be shown to moderators.
6. THE Moderation_Service SHALL paginate the queue with a maximum of 50 reports per page.
7. THE App SHALL display the count of open CRITICAL and HIGH reports as a badge in the admin navigation, updating in near-real-time using Supabase Realtime.
8. WHEN a moderator views any report or sensitive data in the queue, THE Audit_Service SHALL immediately write an audit log entry recording the moderator's hashed ID, the action `staff_read`, the content's hashed ID, and the timestamp.
9. THE App SHALL support filtering the queue by `severity`, `content_type`, `reason`, `status` (open, actioned, dismissed), and date range.
10. THE App SHALL support searching the queue by anonymised report ID.

---

### Requirement 5: Moderation Actions

**User Story:** As a platform moderator, I want to take one of five actions on each report, so that I can respond proportionately to violations and keep the platform safe.

#### Acceptance Criteria

1. THE Moderation_Service SHALL support exactly five actions on any open report: `dismiss`, `remove_content`, `warn`, `suspend`, `ban`.
2. WHEN a moderator selects `dismiss`, THE Moderation_Service SHALL set the report `status` to `dismissed`, record the moderator's ID and a required reason note, and invoke the Audit_Service to log the action.
3. WHEN a moderator selects `remove_content`, THE Moderation_Service SHALL soft-delete the reported content (set `deleted_at`), set the report `status` to `actioned`, add 1 strike to the content author's Profile via the Strike_Service, and invoke the Audit_Service to log the action.
4. WHEN a moderator selects `warn`, THE Moderation_Service SHALL send an in-app notification to the reported user explaining the rule violation in plain language, add 1 strike to the Profile via the Strike_Service, set the report `status` to `actioned`, and invoke the Audit_Service.
5. WHEN a moderator selects `suspend`, THE Moderation_Service SHALL set the reported user's `account_status` to `suspended` with a `suspended_until` timestamp (duration determined by moderator, minimum 24 hours), add 1 strike, set the report `status` to `actioned`, and invoke the Audit_Service.
6. WHEN a moderator selects `ban`, THE Moderation_Service SHALL set the reported user's `account_status` to `banned`, add 1 strike (completing the 3-strike count), set the report `status` to `actioned`, invoke the Strike_Service to check and apply inviter consequences, and invoke the Audit_Service.
7. WHEN a moderation action is applied, THE App SHALL require the moderator to enter a reason note (minimum 10 characters) before confirming; the note SHALL be stored on the moderation action record.
8. WHILE a user's `account_status` is `suspended`, THE App SHALL prevent the suspended user from posting, commenting, reacting, joining crews, or sending messages; they SHALL be able to read content they had access to before the suspension.
9. WHILE a user's `account_status` is `banned`, THE App SHALL prevent the banned user from logging in and SHALL display a plain-language explanation of the ban with an appeal link.
10. THE Moderation_Service SHALL allow moderators to act on multiple reports referencing the same content or user with a single action (bulk action on grouped reports), so that duplicate reports do not require duplicate effort.

---

### Requirement 6: Strike System

**User Story:** As a product owner, I want a transparent strike system so that users who repeatedly violate rules face proportionate escalating consequences, and so that inviters are accountable for who they bring into the community.

#### Acceptance Criteria

1. THE Strike_Service SHALL maintain a `strikes` counter on each Profile, initialised to 0 at account creation.
2. WHEN the Strike_Service adds a strike and the resulting count is 1, THE App SHALL send the user an in-app notification ("You've received a warning. See our Community Rules for what's not allowed.") and no further automatic action SHALL be taken.
3. WHEN the Strike_Service adds a strike and the resulting count reaches 2, THE App SHALL send the user an in-app notification and THE Moderation_Service SHALL automatically apply a 48-hour suspension to the user's account.
4. WHEN the Strike_Service adds a strike and the resulting count reaches 3, THE Moderation_Service SHALL automatically apply a permanent ban to the user's account.
5. IF a user who received their 3rd strike (resulting in a ban) has an `inviter_id` recorded on their Profile, THEN THE Strike_Service SHALL: (a) add 1 warning strike to the Inviter's Profile, (b) set a `invite_privileges_revoked` flag to `true` on the Inviter's Profile permanently, and (c) send the Inviter an in-app notification explaining the consequence without revealing the banned user's identity.
6. THE Invite_Service (foundation-auth) SHALL check the `invite_privileges_revoked` flag before allowing an Inviter to generate new codes; IF the flag is `true`, THEN the Invite_Service SHALL reject new code generation with a descriptive message.
7. THE Strike_Service SHALL record each strike as an individual row in a `profile_strikes` table containing: `profile_id` (hashed in logs), `reason`, `moderation_action_id`, `created_at`, and `applied_by` moderator ID.
8. THE App SHALL allow a user to view their own strike count and the reason for each strike from the Settings screen, but SHALL NOT show the identity of the reporter.
9. WHEN a strike is recorded, THE Audit_Service SHALL log the action with the moderator's hashed ID, the hashed profile ID, the action type, and the timestamp.
10. THE Strike_Service SHALL NOT automatically reduce or expire strikes; only a manual moderator review can remove a strike.

---

### Requirement 7: Crew Admin Moderation Tools

**User Story:** As a Crew admin, I want tools to manage safety within my Crew, so that I can act on harmful content and members before escalating to the platform.

#### Acceptance Criteria

1. THE App SHALL display a crew-admin context menu (visible only to users with role `admin` or `owner`) on every post and comment within their Crew, with options: "Remove post", "Mute member for X hours", "Remove member", "Report to platform".
2. WHEN a Crew_Admin selects "Remove post", THE Crew_Mod_Service SHALL soft-delete the post (set `deleted_at`), record the `deleted_by` admin's ID and a reason, and log the action via the Audit_Service.
3. WHEN a Crew_Admin selects "Mute member for X hours", THE App SHALL display a duration picker with options: 1 hour, 6 hours, 24 hours, 72 hours; THE Crew_Mod_Service SHALL create a mute record with the selected `muted_until` timestamp.
4. WHILE a member is muted within a Crew, THE Crew_Mod_Service SHALL prevent that member from posting or commenting in the Crew; the member SHALL be able to read content.
5. WHEN a Crew_Admin selects "Remove member", THE Crew_Mod_Service SHALL set the member's crew_membership `status` to `removed`, decrement the crew's `member_count`, and log the action via the Audit_Service.
6. WHEN a Crew_Admin selects "Report to platform", THE Crew_Mod_Service SHALL create a Report record with `source` = `crew_admin_escalation`, routing it to the platform Moderation_Queue at the appropriate severity, and SHALL display a confirmation to the admin.
7. THE Crew_Mod_Service SHALL enforce that only Crew_Admins (role `admin` or `owner`) can invoke these tools; Member-role users SHALL receive an authorisation error.
8. THE App SHALL display a crew-level moderation log to Crew_Admins (within the Crew settings page) showing: action type, content/member affected (anonymised), admin who acted, and timestamp — for actions taken within the last 30 days.
9. WHEN a Crew is reported to the platform via "Report to platform", THE Moderation_Service SHALL assess the report at minimum `HIGH` severity regardless of the specific content reason, given that a Crew_Admin has already escalated it.

---

### Requirement 8: Audit Log

**User Story:** As a product owner, I want an immutable audit log of every moderation action and every staff read of sensitive data, so that I can investigate incidents, demonstrate accountability, and comply with data protection requirements.

#### Acceptance Criteria

1. THE Audit_Service SHALL write an audit log entry for every moderation action: `dismiss`, `remove_content`, `warn`, `suspend`, `ban`, crew admin post removal, crew admin member removal, and crew admin mute.
2. THE Audit_Service SHALL write an audit log entry every time a staff member reads a report record, a user's profile in a moderation context, a sensitive table (blocks, strikes, consents), or accesses the Moderation_Queue.
3. EVERY audit log entry SHALL contain exactly these fields: `id` (UUID), `actor_id` (SHA-256 hash of the staff or moderator user ID), `action` (string enum), `target_id` (SHA-256 hash of the content or profile ID), `content_type`, `timestamp` (UTC, millisecond precision), `reason` (nullable text), `session_id` (opaque token identifying the staff session).
4. THE Audit_Service SHALL NEVER write PII (phone numbers, real names, exact dates of birth, IP addresses) to the audit log in plain text; all person identifiers SHALL use SHA-256 hashes.
5. THE App SHALL enforce append-only semantics on the `audit_logs` table via RLS: no role SHALL be permitted to UPDATE or DELETE rows; only INSERT via a trusted server-side function with the service role SHALL be allowed.
6. THE App SHALL deny all read access to the `audit_logs` table for non-admin roles via RLS; only users with a `platform_admin` role SHALL be able to read audit logs.
7. THE Audit_Service SHALL be non-blocking: a failure to write an audit log entry SHALL NOT prevent the underlying moderation action from completing, but the failure SHALL be captured in a dead-letter queue for retry.
8. WHEN a moderator exports audit log data, THE App SHALL produce a CSV or JSON file containing only hashed identifiers and SHALL NOT include any plain-text PII in the export.
9. THE App SHALL retain audit log entries for a minimum of 12 months before any archival or deletion process.

---

### Requirement 9: Rules Page

**User Story:** As a user, I want to read clear, plain-language community rules explaining what is not allowed and what happens if rules are broken, so that I understand the standards I'm agreeing to.

#### Acceptance Criteria

1. THE App SHALL render a Rules_Page accessible from two entry points: (a) the Settings screen under "Community & Safety" and (b) the sign-up / onboarding consent flow.
2. THE Rules_Page SHALL be written in plain language with no legal jargon; the reading level SHALL be appropriate for a 16-year-old user.
3. THE Rules_Page SHALL contain the following four named sections in order: "What's not allowed", "What happens when you report", "What happens to rule-breakers", "How to appeal".
4. THE "What's not allowed" section SHALL list all eight Report_Reason categories with a brief plain-language explanation of each.
5. THE "What happens when you report" section SHALL explain: reports are reviewed by the DivaCrew team, the reporter's identity is kept private, and serious reports (CRITICAL severity) are reviewed within 1 hour.
6. THE "What happens to rule-breakers" section SHALL explain the 3-strike system in plain language: strike 1 is a warning, strike 2 is a 48-hour pause, strike 3 is a permanent removal from DivaCrew.
7. THE "How to appeal" section SHALL provide a plain-language description of the appeals process and a contact method (email address loaded from configuration, not hardcoded).
8. THE Rules_Page SHALL be rendered server-side (SSR) for fast initial load and SHALL be accessible without JavaScript for the static content sections.
9. THE App SHALL display the Rules_Page in a readable font size (minimum 16 px body text) with sufficient contrast meeting WCAG 2.1 AA in both light and dark themes.
10. THE App SHALL include a "Last updated" date on the Rules_Page, loaded from a configurable value so that it can be updated without a code deployment.
11. WHEN the Rules_Page is displayed during the onboarding flow, THE App SHALL include a prominent "I understand the rules" acknowledgement button that the Onboarding_Service records alongside the consent record.

---

### Requirement 10: RLS Policies for Moderation Tables

**User Story:** As a developer, I want Row Level Security policies on all moderation tables, so that reporters cannot read other users' reports, moderators cannot tamper with audit logs, and users cannot access the moderation queue.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on all new tables introduced by this spec: `reports`, `moderation_actions`, `profile_strikes`, `mutes`, `audit_logs`, `crisis_resources`, `crew_mod_logs`.
2. THE App SHALL allow a user to insert a report into the `reports` table only via a trusted server-side function; direct client inserts SHALL be blocked by RLS.
3. THE App SHALL allow a user to read only reports they themselves submitted from the `reports` table; reading other users' reports SHALL be blocked by RLS.
4. THE App SHALL allow only users with a `moderator` or `platform_admin` role to read all rows in `reports` and `moderation_actions`; any attempt by a non-moderator to read these tables SHALL return an empty result set.
5. THE App SHALL enforce append-only access on `audit_logs` as defined in Requirement 8, Criterion 5.
6. THE App SHALL allow a user to read only their own rows in `profile_strikes`; moderators SHALL be able to read all rows in `profile_strikes`.
7. THE App SHALL allow a user to read only mutes that apply to them (where `target_user_id` = their ID); Crew_Admins SHALL be able to read mutes within their Crew; platform moderators SHALL be able to read all mutes.
8. THE App SHALL allow only users with a `platform_admin` role to read, insert, or update rows in `crisis_resources`; all authenticated users SHALL be able to read only `active` = `true` rows via a server-side function.
9. THE App SHALL deny all access to all moderation tables for unauthenticated requests.

---

### Requirement 11: Blocking Tests

**User Story:** As a developer, I want automated tests verifying the bi-directional block enforcement, so that block logic is never accidentally broken across surfaces.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when user A blocks user B, a subsequent feed query as user A returns no posts authored by user B.
2. THE test suite SHALL include a Vitest unit test verifying: when user A blocks user B, a subsequent feed query as user B returns no posts authored by user A (bi-directional invisibility).
3. THE test suite SHALL include a Vitest unit test verifying: when user A blocks user B, user B's attempt to send a direct message to user A is rejected with an authorisation error.
4. THE test suite SHALL include a Vitest unit test verifying: when user A blocks user B, user B cannot react to or comment on user A's posts.
5. THE test suite SHALL include a round-trip property: FOR ALL pairs of users (A, B) where a block record exists from A to B, any content query executed with user A's JWT that could return content authored by user B SHALL return an empty result for user B's content, regardless of content type (posts, comments, crew posts). (Round-trip: create block → query all surfaces → assert user B's content absent from user A's results)
6. THE test suite SHALL include a Vitest unit test verifying: when user A unblocks user B, user B's content reappears in user A's feed on the next query.
7. THE test suite SHALL include a Playwright end-to-end test simulating: user A blocks user B, navigates to the feed and a crew, confirms user B's content is absent, then unblocks user B and confirms content reappears.

---

### Requirement 12: Strike Propagation Tests

**User Story:** As a developer, I want automated tests verifying the strike system and inviter consequence propagation, so that the accountability chain is always correctly enforced.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when the Strike_Service adds a 1st strike to a profile, the profile's `strikes` count is 1 and no suspension is applied.
2. THE test suite SHALL include a Vitest unit test verifying: when the Strike_Service adds a 2nd strike to a profile, the profile's `strikes` count is 2 and the account is automatically suspended for 48 hours.
3. THE test suite SHALL include a Vitest unit test verifying: when the Strike_Service adds a 3rd strike to a profile, the profile's `strikes` count is 3 and the account is permanently banned.
4. THE test suite SHALL include a Vitest unit test verifying: when a user with `inviter_id` set is banned (3rd strike), the Inviter's `strikes` count increments by 1 and the Inviter's `invite_privileges_revoked` flag is set to `true`.
5. THE test suite SHALL include a Vitest unit test verifying: when a user WITHOUT `inviter_id` is banned, no changes are made to any other profile's strike count or invite privileges.
6. THE test suite SHALL include a round-trip property: FOR ALL profiles P with an `inviter_id` pointing to inviter I, when P accumulates 3 strikes and is banned, the resulting state of I SHALL have `invite_privileges_revoked` = `true` and `strikes` = I's prior strikes + 1, regardless of the order in which the 3 strikes were applied. (Round-trip: create inviter I → create invitee P with inviter_id = I → apply 3 strikes to P → assert I's state)
7. THE test suite SHALL include a Vitest unit test verifying: after `invite_privileges_revoked` is set on profile I, the Invite_Service rejects any attempt by I to generate a new invite code.
8. THE test suite SHALL include a Playwright end-to-end test simulating: a moderator applies `ban` to a user who was invited, and confirms that the inviter's profile shows a warning and their invite generation option is disabled in the UI.

---

### Requirement 13: Audit Logging Tests

**User Story:** As a developer, I want automated tests verifying the audit log is written correctly and contains no PII, so that the audit trail is trustworthy and compliant.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when any moderation action (dismiss, remove_content, warn, suspend, ban) is applied, the Audit_Service writes exactly one audit log entry with the correct `action`, hashed `actor_id`, hashed `target_id`, and `timestamp`.
2. THE test suite SHALL include a Vitest unit test verifying: audit log entries written by the Audit_Service do NOT contain any of the following in plain text: phone numbers, real names, raw user IDs (un-hashed), IP addresses, or dates of birth.
3. THE test suite SHALL include a Vitest unit test verifying: when a moderator reads a report (staff_read event), the Audit_Service writes an audit log entry recording the staff_read action.
4. THE test suite SHALL include a Vitest unit test verifying: an attempt to UPDATE or DELETE a row in the `audit_logs` table via the Supabase client is rejected by RLS, regardless of the requester's role.
5. THE test suite SHALL include a round-trip property: FOR ALL moderation actions applied to any content item, the audit log entry count for that content item's `target_id` SHALL equal the number of actions applied, confirming no entries are silently dropped. (Round-trip: apply N actions → query audit_logs by target_id hash → assert count = N)
6. THE test suite SHALL include a Vitest unit test verifying: the Audit_Service does NOT block the moderation action when the audit log write fails; the moderation action completes and the failed log entry is added to the dead-letter queue.
7. THE test suite SHALL include a Vitest unit test verifying: when a Crew_Admin removes a post or member, the Audit_Service writes an audit log entry for that crew-level moderation action.
