# Requirements Document

## Introduction

Crew Check-in is a safety-oriented feature of DivaCrew that lets a user share their status with up to five trusted contacts — other DivaCrew members who have explicitly accepted a contact request. The user can broadcast a status (🟢 I'm good, 🟡 Check on me, 🔴 Need help), optionally attach a coarse area name, and optionally set a timed check-in so that trusted contacts are notified if the user does not mark themselves safe in time.

This feature lives in the Check-in tab (4th in the bottom nav, between Fits and Me). It is a tool to help trusted people keep an eye on each other. It is **not** an emergency service and must never claim to be one. The emergency number in India is 112, and this must be surfaced prominently in the UI.

The audience may include minors (16–17). All privacy-first defaults, minimal data collection, and DPDP Act compliance rules apply throughout. Check-in data lives in isolated tables with strict Row Level Security, audit-logged staff access, and automatic deletion after 7 days. Location is off by default, coarse only, and auto-deleted 24 hours after a check-in session ends.

This spec builds on:
- **foundation-auth**: authenticated profiles, `verification_status`, `age_bracket`, block list, privacy settings, push notification infrastructure.
- **event-groups**: scheduled job pattern (`Auto_Archiver`, `Message_Deleter`) — reused here as `Location_Deleter` (24 h) and `Checkin_Data_Deleter` (7 days).

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Checkin_Service**: The server-side component in `/lib/checkin` responsible for managing check-in sessions, status updates, and timed check-in expiry.
- **Contact_Service**: The server-side component in `/lib/checkin` responsible for managing trusted contact requests, acceptance, and removal.
- **Notification_Service**: The shared server-side component (defined in foundation-auth) that sends push notifications and in-app notifications to a user's device.
- **Audit_Logger**: The server-side component in `/lib/security` that records every staff access to sensitive tables with a timestamp, staff ID, and reason — without PII.
- **Location_Deleter**: A scheduled job that hard-deletes coarse location records attached to check-in sessions that ended more than 24 hours ago.
- **Checkin_Data_Deleter**: A scheduled job that hard-deletes all check-in session rows (and associated records) that are more than 7 days old.
- **Trusted_Contact**: A DivaCrew member who has explicitly accepted a contact request from the owner. The relationship is stored in the `trusted_contacts` table.
- **Contact_Request**: A row in `contact_requests` sent by one user to another, pending explicit acceptance.
- **Checkin_Session**: A row in `checkin_sessions` representing a single check-in event, with a status, optional coarse location, optional expiry time, and lifecycle timestamps.
- **Status**: One of three values: `good` (🟢 I'm good), `check` (🟡 Check on me), `help` (🔴 Need help).
- **Coarse_Area**: A short, human-typed area name (e.g., "near CP", "Lajpat Nagar area") — never GPS coordinates or a map pin.
- **Timed_Checkin**: A Checkin_Session with a non-null `expires_at` timestamp. If the user does not update their status to `good` before `expires_at`, trusted contacts receive a notification.
- **Screenshot_Block**: A best-effort platform mechanism (CSS `user-select: none`, `content-visibility`, PWA manifest hints) that attempts to prevent screenshots on sensitive screens.
- **Onboarding_Explainer**: A one-time modal shown the first time a user opens the Check-in tab, explaining what the feature is, what it is not, and how data is handled.
- **Profile**: A row in the `profiles` table as defined in the foundation-auth spec.
- **Age_Bracket**: `minor` (under 18) or `adult` (18+) as defined in the foundation-auth spec.
- **Minor**: A user whose Age_Bracket is `minor`.

---

## Requirements

### Requirement 1: One-Time Onboarding Explainer

**User Story:** As a new user opening the Check-in tab for the first time, I want to see a clear explanation of what this feature is, what it is not, and how my data is handled, so that I can give informed consent before using it.

#### Acceptance Criteria

1. WHEN a user opens the Check-in tab for the first time (no prior `checkin_consent` record exists for that user), THE App SHALL display the Onboarding_Explainer as a full-screen modal before showing any check-in UI.
2. THE Onboarding_Explainer SHALL include all of the following statements, each clearly visible:
   a. What the feature does: "Share your status with up to 5 trusted contacts — people you choose."
   b. What it does not do: "This feature does not contact emergency services. In an emergency, call 112."
   c. Location handling: "Your location is off by default. If you share it, only a general area name is used — never your exact address. It is deleted automatically 24 hours after your check-in ends."
   d. Data retention: "Check-in data is deleted after 7 days."
   e. Access control: "Only you and your trusted contacts can see your check-in status."
3. THE Onboarding_Explainer SHALL include a tappable "Call 112" button rendered as a `tel:112` link, visible and accessible from the explainer.
4. WHEN a user taps "Got it" on the Onboarding_Explainer, THE Checkin_Service SHALL create a `checkin_consent` record containing `user_id`, `consented_at` timestamp, and `explainer_version`, then dismiss the modal.
5. IF a user dismisses the Onboarding_Explainer without tapping "Got it" (e.g., navigates away), THE App SHALL display the explainer again the next time the user opens the Check-in tab.
6. THE App SHALL NOT allow any check-in actions (setting status, adding contacts, starting a timed check-in) until the Onboarding_Explainer has been accepted.
7. THE Onboarding_Explainer SHALL be accessible: keyboard navigable, all text readable at WCAG 2.1 AA contrast ratios, and the "Call 112" link labelled with accessible text "Call emergency services — 112".

---

### Requirement 2: Trusted Contacts — Request and Consent

**User Story:** As a user, I want to add up to 5 trusted contacts who have explicitly agreed to be my contacts, so that only people I trust can see my check-in status.

#### Acceptance Criteria

1. THE Contact_Service SHALL enforce a maximum of 5 active Trusted_Contacts per user; attempts to send a Contact_Request when the user already has 5 active Trusted_Contacts SHALL be rejected with a descriptive error.
2. WHEN a user submits a Contact_Request to another DivaCrew member, THE Contact_Service SHALL create a `contact_requests` row with `requester_id`, `recipient_id`, `status` = `pending`, and `created_at`.
3. THE Contact_Service SHALL enforce that a Contact_Request can only be sent to a user who is a registered DivaCrew member; requests to non-existent user IDs SHALL be rejected.
4. THE Contact_Service SHALL enforce that a user cannot send a Contact_Request to themselves.
5. THE Contact_Service SHALL enforce that only one pending Contact_Request may exist between a given requester and recipient pair at a time; duplicate requests SHALL be rejected with a descriptive error.
6. WHEN a Contact_Request is created, THE Notification_Service SHALL send a push notification and in-app notification to the recipient stating "[Nickname] wants to add you as a trusted contact. You can accept or decline."
7. WHEN a recipient taps "Accept" on a Contact_Request, THE Contact_Service SHALL update the `contact_requests` row `status` to `accepted`, create a `trusted_contacts` row with `owner_id` (the original requester), `contact_user_id` (the recipient), `accepted_at`, and send a confirmation notification to the requester.
8. WHEN a recipient taps "Decline" on a Contact_Request, THE Contact_Service SHALL update the `contact_requests` row `status` to `declined` and notify the requester that the request was not accepted, without revealing the reason.
9. THE App SHALL display pending incoming Contact_Requests in the Check-in tab with "Accept" and "Decline" options.
10. WHEN either the contact owner or the Trusted_Contact taps "Remove contact", THE Contact_Service SHALL set `removed_at` on the `trusted_contacts` row (soft-delete) and immediately revoke that contact's access to all future status updates from the owner; the contact SHALL NOT receive any further notifications from that owner.
11. THE Contact_Service SHALL NOT expose a user's contact list to any party other than the user themselves.
12. WHERE a user's `age_bracket` is `minor`, THE Contact_Service SHALL apply the same maximum-5-contacts limit with no additional restriction beyond the standard rules.

---

### Requirement 3: Setting a Check-in Status

**User Story:** As a user, I want to set my check-in status (🟢 I'm good, 🟡 Check on me, 🔴 Need help) so that my trusted contacts know how I'm doing.

#### Acceptance Criteria

1. WHEN a user selects a status and taps "Share status", THE Checkin_Service SHALL create a `checkin_sessions` row with `user_id`, `status` (`good`, `check`, or `help`), `coarse_area` (nullable), `expires_at` (nullable), `created_at`, and `ended_at` (null until closed).
2. WHEN a Checkin_Session is created, THE Notification_Service SHALL send a push notification and in-app notification to each of the user's active Trusted_Contacts containing: the user's nickname, their status emoji and label, and the coarse area name if shared. The notification SHALL NOT include exact location data.
3. THE Checkin_Service SHALL validate that `status` is one of the three allowed values: `good`, `check`, or `help`; any other value SHALL be rejected with a descriptive error.
4. WHEN a user updates their status on an active Checkin_Session, THE Checkin_Service SHALL update the `status` field and `updated_at` on the existing session row and send a new notification to all active Trusted_Contacts with the updated status.
5. WHEN a user taps "End check-in", THE Checkin_Service SHALL set `ended_at` on the Checkin_Session to the current timestamp and notify Trusted_Contacts that the check-in has ended.
6. THE App SHALL display the user's current active Checkin_Session status on the Check-in tab home screen. IF no session is active, THE App SHALL display a prompt to start a new check-in.
7. THE App SHALL display a persistent disclaimer on the Check-in tab status screen: "This does not contact emergency services. In an emergency, call 112." This disclaimer SHALL be visible at all times the status UI is shown.
8. THE App SHALL NEVER use the word "safe" to describe a status or check-in outcome; status labels SHALL be limited to "I'm good", "Check on me", and "Need help".
9. WHEN a Trusted_Contact receives a status notification, THE App SHALL display the status update in an in-app feed on the Check-in tab showing the sender's nickname, status, coarse area (if shared), and time.

---

### Requirement 4: 🔴 Need Help Screen

**User Story:** As a user setting the 🔴 Need Help status, I want a persistent, prominent screen with clear actions so that I can quickly signal distress to my trusted contacts and access emergency information.

#### Acceptance Criteria

1. WHEN a user selects the `help` status, THE App SHALL display the Need_Help_Screen as a full-screen overlay that cannot be accidentally dismissed (no swipe-to-dismiss, no tap-outside-to-close).
2. THE Need_Help_Screen SHALL contain all of the following, each visible and tappable:
   a. A prominent disclaimer: "This does not automatically contact emergency services."
   b. A "Call 112" button rendered as a `tel:112` link with accessible label "Call emergency services — 112".
   c. A "Share my area" section allowing the user to type or select a Coarse_Area from a short preset list (e.g., "Near home", "At college", "In transit", or free text).
   d. A "Send message to my trusted contacts" button that, when tapped, sends a message to all active Trusted_Contacts via the Notification_Service.
3. THE Need_Help_Screen SHALL apply Screenshot_Block on the screen where the platform allows it, and SHALL document in code that this is best-effort.
4. THE Need_Help_Screen SHALL remain visible until the user explicitly taps "I'm okay now", which SHALL update the Checkin_Session status to `good` and dismiss the screen.
5. WHEN "Send message to my trusted contacts" is tapped, THE Notification_Service SHALL immediately dispatch a push notification and in-app notification to all active Trusted_Contacts stating "[Nickname] has marked 🔴 Need help" and the coarse area if provided.
6. IF the user has no active Trusted_Contacts, THE Need_Help_Screen SHALL still display the "Call 112" button and area-sharing UI, and SHALL display a message: "You have no trusted contacts yet — call 112 in an emergency."
7. THE App SHALL NOT display any message on the Need_Help_Screen implying that any action taken (including notifying contacts) guarantees assistance or safety.
8. THE Need_Help_Screen SHALL be accessible: the "Call 112" button SHALL be reachable by keyboard navigation and have a minimum touch target of 44×44 px.

---

### Requirement 5: Optional Location Sharing (Coarse Area)

**User Story:** As a user, I want to optionally share a coarse area name with my trusted contacts so that they have a general sense of where I am, without sharing my exact location.

#### Acceptance Criteria

1. THE Checkin_Service SHALL treat location sharing as opt-in: `coarse_area` SHALL be null by default on every new Checkin_Session unless the user explicitly adds it.
2. WHEN a user provides a `coarse_area`, THE Checkin_Service SHALL validate that it is a non-empty string of at most 100 characters; it SHALL NOT accept GPS coordinate patterns (decimal degrees or DMS notation) and SHALL reject them with a descriptive error: "Please enter an area name, not coordinates — for example 'near CP'."
3. THE App SHALL provide a free-text input and a short preset list (e.g., "Near home", "At college", "In transit") for entering a Coarse_Area; THE App SHALL NOT include a map picker, GPS autofill, or any device-location-sensing UI element.
4. THE Checkin_Service SHALL NOT store or log GPS coordinates, device location signals, or IP-derived location in any check-in record.
5. WHEN a Checkin_Session ends (either by the user or by expiry), THE Location_Deleter SHALL be scheduled to hard-delete the `coarse_area` field on that session after 24 hours have elapsed since `ended_at`.
6. THE App SHALL display a notice beneath the location input: "Only a general area name — never your exact address. Deleted 24 hours after your check-in ends."
7. THE Checkin_Service SHALL only expose the `coarse_area` value to the user themselves and their active Trusted_Contacts; no other party (including staff read-paths) SHALL access `coarse_area` without Audit_Logger recording.

---

### Requirement 6: Timed Check-in

**User Story:** As a user, I want to set a timed check-in (e.g., "Check in with me in 2 hours") so that my trusted contacts are automatically notified if I don't mark myself safe in time.

#### Acceptance Criteria

1. WHEN a user creates a Checkin_Session with a duration, THE Checkin_Service SHALL set `expires_at` to `created_at + duration`; allowed durations are 30 minutes, 1 hour, 2 hours, 4 hours, and 8 hours.
2. IF a duration outside the allowed values is submitted, THE Checkin_Service SHALL reject the request with a descriptive error listing the valid options.
3. THE App SHALL display a countdown timer on the Check-in tab showing the time remaining until `expires_at` while a Timed_Checkin is active.
4. WHEN `expires_at` is reached and the Checkin_Session `status` is not `good`, THE Checkin_Service SHALL mark the session as `expired` and THE Notification_Service SHALL send a push notification and in-app notification to all active Trusted_Contacts: "[Nickname] set a timed check-in that has expired. Please check on them."
5. WHEN `expires_at` is reached and the Checkin_Session `status` is `good`, THE Checkin_Service SHALL mark the session as `completed` and SHALL NOT send any notification.
6. WHEN a user updates their status to `good` before `expires_at`, THE Checkin_Service SHALL mark the session as `completed` and cancel the expiry notification.
7. THE App SHALL display a warning notification to the user 15 minutes before `expires_at`: "Your check-in expires in 15 minutes. Mark yourself good if you're okay."
8. THE Checkin_Service SHALL use a server-side scheduled job pattern (consistent with the `Auto_Archiver` pattern from event-groups) to evaluate expiry; client-side timers alone SHALL NOT be relied upon for expiry logic.
9. THE App SHALL NOT use the word "safe" in timed check-in copy; copy SHALL say "mark yourself good" or "check in with me in X hours".

---

### Requirement 7: Screenshot Blocking on Sensitive Screens

**User Story:** As a user, I want the app to attempt to block screenshots on my check-in screens, so that my status and area are not accidentally captured by others.

#### Acceptance Criteria

1. THE App SHALL apply Screenshot_Block on the Need_Help_Screen (🔴 status), the active Checkin_Session status screen, and the trusted contacts list screen, using the best available platform mechanism.
2. THE App SHALL implement Screenshot_Block using CSS `user-select: none` and `content-visibility` hints where applicable; for Android PWA contexts, the implementation SHALL document the use of `disableScreenCapture` manifest hints where the platform supports them.
3. THE App SHALL display a visible notice on all screenshot-blocked screens: "Screenshots are blocked on this screen to protect your privacy. This is best-effort and may not work on all devices."
4. THE App SHALL NOT claim that screenshot blocking is guaranteed or infallible; all documentation and user-facing copy SHALL describe this as best-effort protection.
5. THE App SHALL apply Screenshot_Block consistently: the block SHALL be applied when the screen first renders and SHALL be removed when the user navigates away from the sensitive screen.

---

### Requirement 8: Data Storage, RLS, and Audit Logging

**User Story:** As a product owner, I want check-in data stored in isolated tables with strict RLS and full audit logging of staff access, so that sensitive check-in data is protected and access is accountable.

#### Acceptance Criteria

1. THE App SHALL store check-in data in the following dedicated tables: `checkin_sessions`, `trusted_contacts`, `contact_requests`, `checkin_consent`, and `checkin_notifications_log`.
2. THE App SHALL enable Row Level Security on all tables listed in criterion 1.
3. WHILE a user is authenticated, THE App SHALL allow that user to read and write only their own rows in `checkin_sessions` and `checkin_consent`.
4. WHILE a user is authenticated, THE App SHALL allow a user to read `checkin_sessions` rows from other users only if the reading user is an active Trusted_Contact of the session owner — this policy SHALL be enforced at the database layer via RLS.
5. WHILE a user is authenticated, THE App SHALL allow that user to read only their own rows in `trusted_contacts` (where `owner_id` equals their user ID); the contact's own view of the relationship SHALL be limited to whether they appear as a contact for someone else.
6. THE App SHALL NOT allow any client to insert or update `trusted_contacts` rows directly; all mutations SHALL be performed via server-side functions with the service role.
7. THE App SHALL NOT allow any client to insert directly into `checkin_notifications_log`; all inserts SHALL be performed via the Notification_Service server-side function.
8. THE App SHALL deny all access to all check-in tables for unauthenticated requests.
9. WHEN any staff member reads a row in `checkin_sessions`, `trusted_contacts`, or any check-in table via an admin or service-role path, THE Audit_Logger SHALL record: `staff_id`, `table_name`, `row_id`, `accessed_at`, and `reason`; the log entry SHALL NOT contain PII (no phone numbers, no exact location, no message content).
10. THE App SHALL NEVER log phone numbers, check-in status values, coarse area names, or contact lists in plain-text application logs or error traces.

---

### Requirement 9: Automatic Data Deletion

**User Story:** As a user, I want my check-in data and location automatically deleted on schedule, so that sensitive data does not accumulate and I don't have to manage it manually.

#### Acceptance Criteria

1. THE Location_Deleter SHALL run on a scheduled basis at a minimum interval of every 60 minutes and SHALL hard-delete (not soft-delete) the `coarse_area` field on all `checkin_sessions` rows where `ended_at IS NOT NULL` and `ended_at + 24 hours ≤ now`.
2. THE Checkin_Data_Deleter SHALL run on a scheduled basis at a minimum interval of every 60 minutes and SHALL hard-delete all rows in `checkin_sessions` (and cascade-delete associated `checkin_notifications_log` rows) where `created_at + 7 days ≤ now`.
3. THE Checkin_Data_Deleter SHALL also hard-delete rows in `contact_requests` where `created_at + 7 days ≤ now` and `status` is `declined` or `pending`.
4. THE Checkin_Service SHALL use a server-side configuration value `LOCATION_DELETE_HOURS` (default 24) and `CHECKIN_RETENTION_DAYS` (default 7) to compute deletion thresholds at job-run time.
5. IF `LOCATION_DELETE_HOURS` is set to a value less than 1 or greater than 48, THE Checkin_Service SHALL reject the configuration at startup with a descriptive error.
6. IF `CHECKIN_RETENTION_DAYS` is set to a value less than 1 or greater than 30, THE Checkin_Service SHALL reject the configuration at startup with a descriptive error.
7. THE Checkin_Data_Deleter SHALL hard-delete rows (physical removal), not soft-delete, because the data retention purpose has been fulfilled.
8. THE App SHALL NOT expose any user-facing UI for manual deletion of check-in data beyond the normal "End check-in" action; deletion is handled automatically by the jobs.

---

### Requirement 10: Access Control Tests — Non-Contact Isolation

**User Story:** As a developer, I want automated tests verifying that a non-contact cannot read any check-in data, so that the RLS policies are continuously verified and privacy regressions are caught immediately.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test that verifies: when a user who is NOT a Trusted_Contact of the session owner queries `checkin_sessions` for that owner's session, the query returns zero rows.
2. THE test suite SHALL include a Vitest unit test that verifies: when an unauthenticated client queries any check-in table, the query returns zero rows or an authorisation error.
3. THE test suite SHALL include a Vitest unit test that verifies: when an authenticated user who is a Trusted_Contact of the session owner queries `checkin_sessions`, the query returns the owner's active session.
4. THE test suite SHALL include a Vitest unit test that verifies: when a Trusted_Contact relationship is removed (soft-deleted via `removed_at`), the former contact can no longer read the owner's `checkin_sessions` rows.
5. THE test suite SHALL include a round-trip property: FOR ALL valid Checkin_Sessions created by any user, a query by that same user SHALL return the session with status and `coarse_area` equal to the values at insert time (round-trip: create → query → assert equality).
6. THE test suite SHALL include a Playwright end-to-end test that signs in as a second user (not a trusted contact) and confirms that navigating to the check-in tab shows no data belonging to a different user's session.
7. THE test suite SHALL include a Vitest unit test verifying that the Audit_Logger records an entry when a staff-role access to `checkin_sessions` is performed, and that the log entry contains `staff_id`, `table_name`, `row_id`, `accessed_at`, and `reason` — and does NOT contain any PII field.

---

### Requirement 11: Timed Check-in Expiry Job Tests

**User Story:** As a developer, I want automated tests for the timed check-in expiry logic so that notification-on-expiry and safe-cancellation paths are continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when the expiry job runs for a Timed_Checkin whose `expires_at ≤ now` and `status` is not `good`, the session is marked `expired` and a notification record is created for all active Trusted_Contacts.
2. THE test suite SHALL include a Vitest unit test verifying: when the expiry job runs for a Timed_Checkin whose `expires_at ≤ now` and `status` is `good`, the session is marked `completed` and no notification is sent.
3. THE test suite SHALL include a Vitest unit test verifying: when the expiry job runs for a Timed_Checkin whose `expires_at > now`, the session status and `ended_at` remain unchanged.
4. THE test suite SHALL include a Vitest unit test verifying: when a user updates status to `good` before `expires_at`, the session is marked `completed` and any scheduled expiry notification is cancelled.
5. THE test suite SHALL include a property-based test: FOR ALL Timed_Checkin durations in the allowed set {30 min, 1 h, 2 h, 4 h, 8 h}, a session created at time T with duration D SHALL have `expires_at` equal to T + D (round-trip: create with duration → read `expires_at` → assert).

---

### Requirement 12: Location and Data Deletion Job Tests

**User Story:** As a developer, I want automated tests for the Location_Deleter and Checkin_Data_Deleter jobs so that privacy-critical deletion logic is continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when the Location_Deleter runs for a session with `ended_at` more than 24 hours ago, the `coarse_area` field is null after the job runs.
2. THE test suite SHALL include a Vitest unit test verifying: when the Location_Deleter runs for a session with `ended_at` less than 24 hours ago, the `coarse_area` field remains unchanged.
3. THE test suite SHALL include a Vitest unit test verifying: when the Location_Deleter runs for a session with `ended_at IS NULL` (still active), the `coarse_area` field remains unchanged.
4. THE test suite SHALL include a Vitest unit test verifying: when the Checkin_Data_Deleter runs for a session with `created_at` more than 7 days ago, the session row no longer exists after the job runs.
5. THE test suite SHALL include a Vitest unit test verifying: when the Checkin_Data_Deleter runs for a session with `created_at` less than 7 days ago, the session row still exists.
6. THE test suite SHALL include a property-based test: FOR ALL sessions where `ended_at IS NOT NULL`, after the Location_Deleter has run, the `coarse_area` field SHALL be null if and only if `ended_at + 24 hours ≤ now` (invariant: deletion threshold is respected for all sessions simultaneously).
