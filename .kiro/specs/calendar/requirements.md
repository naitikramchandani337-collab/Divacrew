# Requirements Document

## Introduction

Calendar is a combined personal planner and Crew-wide scheduling feature for DivaCrew. It gives every user a single calendar view that layers private personal reminders, saved Event Groups, and shared Crew calendar entries from all the user's Crews — styled like Google Calendar with multiple overlaid, colour-coded calendars.

The feature has two distinct sub-systems:

- **Personal Planner**: Completely private. The user can create freeform reminders (with category, date/time, optional note), save Event Group entries, set check-in reminders, and opt in to Fit Check poll-closing reminders. Nothing in the Personal Planner is ever visible to anyone else, including Crew admins.
- **Crew Calendar**: One shared calendar per Crew, managed by Crew Admins/Owners. Members read the calendar and can copy entries to their Personal Planner with one tap. Crew calendar entries are lighter-weight than Event Groups — no chat, no group membership, just dates and descriptions.

The combined view (accessible from the Me tab or a dedicated nav entry) shows all sources overlaid, colour-coded by source, with per-Crew toggle controls. Tapping any entry navigates to the correct destination.

No Google Calendar / iCal sync in v1. No shared personal calendars between users. No public event discovery via the calendar.

This spec builds on:
- **foundation-auth**: `profiles`, `verification_status`, push notification infrastructure (`Notification_Service`).
- **crews**: `crew_memberships`, roles (`owner`/`admin`/`member`), the Crew tab structure (the Calendar tab is currently a placeholder — this spec implements it).
- **event-groups**: `event_groups` table (`start_time`, `end_time`, `coarse_location`, `crew_id`) — saved events reference these rows.
- **crew-checkin**: check-in reminders link to the Check-in tab flow.
- **fit-check**: `fit_check_posts` table — Fit Check poll-closing reminders reference these rows.

The audience may include minors (16–17). All privacy-first defaults and minimal data collection rules apply throughout. Personal reminder data is strictly isolated by Row Level Security.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Calendar_Service**: The server-side component in `/lib/calendar` responsible for creating, fetching, updating, and soft-deleting personal reminders, saved events, and Crew calendar entries.
- **Notification_Service**: The shared server-side component (defined in foundation-auth) that sends push notifications and in-app notifications.
- **Personal_Reminder**: A private record in the `personal_reminders` table created by a user. Visible only to that user. Has a title, date/time, optional note, and optional category.
- **Reminder_Category**: One of five values the user may assign to a Personal_Reminder: `social`, `college`, `work`, `health`, or `other`.
- **Saved_Event**: A record in the `saved_events` table linking a user to an `event_groups` row they have saved to their Personal Planner with "Add to my calendar".
- **Checkin_Reminder**: A specialised Personal_Reminder with `reminder_type` = `checkin`. Tapping its notification or its calendar entry opens the Check-in tab.
- **FitCheck_Reminder**: A specialised Personal_Reminder with `reminder_type` = `fit_check_poll`. Created when a user opts in to a poll-closing notification at the time they create or vote on a Fit Check post. Fires 30 minutes before `closes_at` on the associated `fit_check_posts` row.
- **Crew_Calendar_Entry**: A record in the `crew_calendar_entries` table representing a Crew-wide calendar item created by a Crew Admin or Owner. Has a title, date/time, optional description, and optional coarse area. Visible to all active members of that Crew.
- **Combined_View**: The main Calendar screen that displays all calendar sources (Personal_Reminders, Saved_Events, Crew_Calendar_Entries from all joined Crews) overlaid in a single monthly/weekly/agenda layout.
- **Calendar_Source**: One logical calendar layer in the Combined_View — either the Personal Planner layer or one per-Crew layer.
- **Source_Colour**: A display colour assigned to each Calendar_Source. Personal reminders have a fixed colour. Saved events have a fixed colour. Each Crew gets a colour assigned automatically from a predefined palette.
- **Crew_Toggle**: A per-Crew on/off switch in the Combined_View sidebar or sheet that shows or hides that Crew's Crew_Calendar_Entries from the view.
- **Coarse_Area**: A short, human-typed area name (e.g., "near CP", "Lajpat Nagar area") — never GPS coordinates or a map pin. Identical convention to event-groups and crew-checkin specs.
- **Colour_Palette**: A server-defined ordered list of at least 10 distinct display colours used for automatic Crew colour assignment.
- **Profile**: A row in the `profiles` table as defined in the foundation-auth spec.
- **Crew_Member**: A user with an active membership record for a given Crew, as defined in the crews spec.
- **Event_Group**: A row in the `event_groups` table as defined in the event-groups spec.
- **Fit_Check_Post**: A row in the `fit_check_posts` table as defined in the fit-check spec.

---

## Requirements

### Requirement 1: Personal Reminder Creation

**User Story:** As a user, I want to create a private personal reminder with a title, date/time, optional note, and optional category, so that I can keep track of things that matter only to me.

#### Acceptance Criteria

1. WHEN an authenticated user submits a personal reminder, THE Calendar_Service SHALL create a `personal_reminders` record containing: `user_id`, `title` (1–150 characters), `reminder_at` (ISO 8601 datetime), `note` (optional, up to 500 characters), `category` (optional, one of `social`, `college`, `work`, `health`, `other`), `reminder_type` (default `general`), `created_at`, `updated_at`, and `deleted_at` (null by default).
2. THE Calendar_Service SHALL validate that `title` is between 1 and 150 characters and is not empty or whitespace-only; invalid values SHALL be rejected with a descriptive error.
3. THE Calendar_Service SHALL validate that `reminder_at` is a valid ISO 8601 datetime; invalid or missing values SHALL be rejected with a descriptive error.
4. WHEN `category` is provided, THE Calendar_Service SHALL validate that it is one of the five allowed values: `social`, `college`, `work`, `health`, or `other`; unknown values SHALL be rejected with a descriptive error.
5. WHEN a Personal_Reminder is created successfully, THE App SHALL add it to the Combined_View at the correct date/time position and display it in the Personal Planner colour.
6. WHEN a user edits a Personal_Reminder, THE Calendar_Service SHALL update the `title`, `reminder_at`, `note`, and `category` fields and set `updated_at` to the current timestamp; the same validation rules from criteria 2–4 SHALL apply.
7. WHEN a user deletes a Personal_Reminder, THE Calendar_Service SHALL soft-delete the record by setting `deleted_at` to the current timestamp; the row SHALL NOT be physically removed.
8. THE Calendar_Service SHALL enforce that only the owner (`user_id`) of a Personal_Reminder may read, update, or delete it; all other access attempts SHALL be rejected by RLS at the database layer.

---

### Requirement 2: Personal Reminders Are Completely Private

**User Story:** As a user, I want my personal reminders to be completely invisible to everyone else — including Crew admins — so that I can plan freely without worrying about who can see what.

#### Acceptance Criteria

1. THE App SHALL enforce Row Level Security on the `personal_reminders` table such that only the authenticated user whose `user_id` matches the row may read or write it.
2. THE Calendar_Service SHALL NOT expose any Personal_Reminder field in any Crew-facing API, admin API, or shared data feed.
3. THE App SHALL NOT surface Personal_Reminder content in any push notification payload beyond a generic title (e.g., "You have a reminder 💛"); the `note`, `category`, and `title` of the reminder SHALL NOT appear in the push notification payload sent to the device or notification service.
4. IF any unauthenticated request or a request from a different authenticated user queries the `personal_reminders` table, THE App SHALL receive an empty result set (zero rows), enforced at the database layer by RLS.
5. THE App SHALL display a persistent disclosure on the Personal Planner section of the Combined_View: "Only you can see your personal reminders 🔒".

---

### Requirement 3: Saving an Event Group to the Personal Calendar

**User Story:** As a user, I want to save any Event Group to my personal calendar with one tap, so that I can keep track of events without joining the group or exposing anything to others.

#### Acceptance Criteria

1. THE App SHALL display an "Add to my calendar" button on every Event_Group card and detail view visible to the authenticated user.
2. WHEN a user taps "Add to my calendar" on an Event_Group, THE Calendar_Service SHALL create a `saved_events` record containing: `user_id`, `event_group_id`, `saved_at`, and `deleted_at` (null by default); it SHALL NOT duplicate an existing record for the same `user_id` and `event_group_id`.
3. WHEN a `saved_events` record is created, THE App SHALL display the Event_Group in the Combined_View at the `start_time` position of the Event_Group row, using the Saved Event colour.
4. THE App SHALL display the "Add to my calendar" button as "Added ✓" after the user has saved the event, preventing a second tap from creating a duplicate record.
5. WHEN a user removes a saved event from the calendar, THE Calendar_Service SHALL soft-delete the `saved_events` record by setting `deleted_at`; the Event_Group SHALL be removed from the Combined_View immediately.
6. THE Calendar_Service SHALL enforce RLS: only the owner (`user_id`) of a `saved_events` record may read or delete it.
7. WHEN an Event_Group is soft-deleted in the `event_groups` table (`deleted_at` is not null), THE Calendar_Service SHALL exclude the associated `saved_events` entries from all Combined_View responses for all users.

---

### Requirement 4: Check-in Reminder

**User Story:** As a user, I want to set a reminder linked to the Check-in tab (e.g., "Going out tonight — remind me to start a check-in at 9pm"), so that I don't forget to check in when I'm heading somewhere.

#### Acceptance Criteria

1. THE App SHALL provide a "Set check-in reminder" action accessible from the Calendar creation flow and from the Check-in tab.
2. WHEN a user creates a check-in reminder, THE Calendar_Service SHALL create a `personal_reminders` record with `reminder_type` = `checkin`, a `title` set by the user (1–150 characters), and a `reminder_at` datetime set by the user; `note` is optional.
3. WHEN `reminder_at` is reached, THE Notification_Service SHALL send a push notification and in-app notification to the user with the message: "Time to start your check-in 💛"; the notification payload SHALL NOT include the user's location, check-in status, or any PII.
4. WHEN a user taps the in-app notification or the calendar entry for a Checkin_Reminder, THE App SHALL navigate to the Check-in tab.
5. THE Calendar_Service SHALL apply the same privacy rules as all Personal_Reminders: only the owner may read or modify a Checkin_Reminder.

---

### Requirement 5: Fit Check Poll-Closing Reminder

**User Story:** As a user who creates or votes on a Fit Check poll, I want to opt in to a reminder 30 minutes before the poll closes, so that I can check back for the results.

#### Acceptance Criteria

1. WHEN a user creates a Fit_Check_Post or casts a vote on a Fit_Check_Post, THE App SHALL display a "Remind me before poll closes" opt-in toggle; this toggle SHALL default to off.
2. WHEN a user activates the opt-in toggle, THE Calendar_Service SHALL create a `personal_reminders` record with `reminder_type` = `fit_check_poll`, a `fit_check_post_id` reference, and `reminder_at` set to `closes_at - 30 minutes` on the associated `fit_check_posts` row.
3. IF `closes_at - 30 minutes` is in the past at the time the opt-in is activated (i.e., the poll closes in fewer than 30 minutes), THE Calendar_Service SHALL reject the opt-in and THE App SHALL display: "The poll closes too soon to set a reminder 💛".
4. WHEN `reminder_at` is reached, THE Notification_Service SHALL send a push notification and in-app notification: "A Fit Check poll you're following closes soon 💅 — check the results!"; the notification payload SHALL NOT include the poll question, photo descriptions, or any content from the post.
5. WHEN a user taps the in-app notification or the calendar entry for a FitCheck_Reminder, THE App SHALL navigate to the Fit_Check_Post detail view.
6. WHEN a Fit_Check_Post is soft-deleted (`deleted_at` is not null), THE Calendar_Service SHALL soft-delete all associated FitCheck_Reminders for that post and THE Notification_Service SHALL cancel any pending notifications for those reminders.
7. THE Calendar_Service SHALL enforce that a user may only have one FitCheck_Reminder per `fit_check_post_id`; duplicate opt-in attempts SHALL return the existing reminder without creating a new record.

---

### Requirement 6: Push and In-App Notifications for Reminders

**User Story:** As a user, I want a push notification and an in-app notification at the scheduled time for every personal reminder, so that I'm alerted even when the app is not open.

#### Acceptance Criteria

1. WHEN `reminder_at` is reached for any Personal_Reminder with `deleted_at IS NULL`, THE Notification_Service SHALL dispatch a push notification and an in-app notification to the owning user.
2. THE push notification payload for a `general` reminder SHALL contain only a generic message (e.g., "You have a reminder 💛") and SHALL NOT include the `title`, `note`, `category`, or any content from the Personal_Reminder.
3. WHEN a user taps a push notification for a `general` Personal_Reminder, THE App SHALL navigate to the Combined_View and highlight the relevant reminder entry.
4. THE Notification_Service SHALL deliver reminder notifications within 2 minutes of the scheduled `reminder_at` time; delivery outside this window SHALL be treated as a system failure.
5. IF a Personal_Reminder is deleted before `reminder_at` is reached, THE Notification_Service SHALL cancel the pending notification for that reminder.
6. THE Notification_Service SHALL NOT send a notification for a reminder whose `deleted_at` is not null.
7. THE App SHALL display in-app notifications for reminders in the user's notification centre (consistent with the notification infrastructure from foundation-auth), accessible from the Me tab.

---

### Requirement 7: Crew Calendar Entry Creation

**User Story:** As a Crew Admin or Owner, I want to create Crew-wide calendar entries (e.g., exam dates, application deadlines, festival days) for my Crew, so that all members are aware of important dates.

#### Acceptance Criteria

1. WHEN a Crew Admin or Owner submits a Crew calendar entry, THE Calendar_Service SHALL create a `crew_calendar_entries` record containing: `crew_id`, `created_by` (the admin/owner's `user_id`), `title` (1–150 characters), `entry_at` (ISO 8601 datetime), `description` (optional, up to 500 characters), `coarse_area` (optional, up to 100 characters), `created_at`, `updated_at`, and `deleted_at` (null by default).
2. THE Calendar_Service SHALL validate that `title` is between 1 and 150 characters and is not empty or whitespace-only.
3. THE Calendar_Service SHALL validate that `entry_at` is a valid ISO 8601 datetime.
4. WHEN `coarse_area` is provided, THE Calendar_Service SHALL validate that it is a non-empty string of at most 100 characters and SHALL NOT accept GPS coordinate patterns (decimal degrees or DMS notation); GPS-format values SHALL be rejected with a descriptive error: "Please enter an area name, not coordinates — for example 'near CP'."
5. IF a user whose Crew role is `member` attempts to create, update, or delete a Crew_Calendar_Entry for any Crew, THE Calendar_Service SHALL reject the request with an authorisation error.
6. WHEN a Crew_Calendar_Entry is created, THE App SHALL immediately display it to all active members of that Crew in the Combined_View at the `entry_at` position, using that Crew's assigned Source_Colour.
7. WHEN a Crew Admin or Owner edits a Crew_Calendar_Entry, THE Calendar_Service SHALL allow updates to `title`, `entry_at`, `description`, and `coarse_area`; the same validation rules from criteria 2–4 SHALL apply; `updated_at` SHALL be set to the current timestamp.
8. WHEN a Crew Admin or Owner deletes a Crew_Calendar_Entry, THE Calendar_Service SHALL soft-delete the record by setting `deleted_at`; the entry SHALL be removed from all members' Combined_Views immediately.

---

### Requirement 8: Crew Calendar — Read-Only for Members

**User Story:** As a regular Crew member, I want to see Crew calendar entries created by admins but not be able to create or edit them, so that the Crew calendar stays organised and authoritative.

#### Acceptance Criteria

1. THE App SHALL display the Crew Calendar as the Calendar tab inside every Crew, replacing the existing placeholder from the crews spec.
2. WHEN an active Crew_Member (role `member`) opens the Crew Calendar tab, THE Calendar_Service SHALL return all non-deleted Crew_Calendar_Entries for that Crew, ordered by `entry_at` ascending.
3. THE App SHALL NOT render a "Create entry", "Edit", or "Delete" control for users with the `member` role on Crew_Calendar_Entries; these controls SHALL be visible only to users with the `admin` or `owner` role in that Crew.
4. THE App SHALL display each Crew_Calendar_Entry card with: `title`, `entry_at` formatted as human-readable date and time (e.g., "Mon 14 Aug, 6:00 PM"), `description` (if set), `coarse_area` (if set), and an "Add to my calendar" button.
5. WHEN a member taps "Add to my calendar" on a Crew_Calendar_Entry, THE Calendar_Service SHALL create a `personal_reminders` record with `reminder_type` = `crew_entry`, a reference `crew_calendar_entry_id`, and `reminder_at` set to the `entry_at` of the Crew_Calendar_Entry.
6. THE App SHALL display the "Add to my calendar" button as "Added ✓" once the member has saved the entry, preventing duplicate records.

---

### Requirement 9: Combined View — Layout and Navigation

**User Story:** As a user, I want a single Calendar screen that shows all my personal reminders, saved Event Groups, and Crew calendar entries from all my Crews in one place, colour-coded by source, so that I can plan at a glance.

#### Acceptance Criteria

1. THE App SHALL provide a Calendar screen accessible from the Me tab (and optionally as a dedicated navigation entry) that displays the Combined_View.
2. THE Combined_View SHALL support three layout modes switchable by the user: monthly grid, weekly view, and agenda (list) view; the App SHALL persist the user's last-selected layout across sessions.
3. WHEN the Combined_View is displayed, THE Calendar_Service SHALL aggregate and return all of the following for the requested date range: (a) the user's non-deleted Personal_Reminders, (b) the user's non-deleted Saved_Events, (c) non-deleted Crew_Calendar_Entries from all Crews where the user is an active member and the Crew's toggle is on.
4. THE App SHALL display each calendar entry using its Calendar_Source colour: a fixed colour for Personal_Reminders, a fixed colour for Saved_Events, and one automatically assigned colour per Crew for Crew_Calendar_Entries.
5. THE Calendar_Service SHALL assign Source_Colour to each Crew by cycling through the Colour_Palette in a deterministic order based on the user's Crew join order; the same Crew SHALL always display with the same colour for a given user.
6. WHEN the user's Combined_View contains no entries for a given date range, THE App SHALL display an Empty_State with copy such as "Nothing here yet — add a reminder or check your Crew calendars 📅".
7. WHEN the Combined_View is loading, THE App SHALL display skeleton placeholders that match the shape of calendar entry cards.

---

### Requirement 10: Per-Crew Toggle

**User Story:** As a user, I want to toggle each Crew's calendar on or off from the combined view, so that I can focus on what's relevant without permanently removing any source.

#### Acceptance Criteria

1. THE App SHALL display a list of Crew_Toggles in the Combined_View — one toggle per Crew the user belongs to — alongside the Personal Planner toggle and the Saved Events toggle.
2. WHEN a user switches a Crew_Toggle to off, THE App SHALL immediately hide all Crew_Calendar_Entries from that Crew from the Combined_View without removing them from the database.
3. WHEN a user switches a Crew_Toggle back to on, THE App SHALL immediately restore that Crew's Crew_Calendar_Entries to the Combined_View.
4. THE Calendar_Service SHALL persist each toggle state in a `calendar_preferences` table keyed by `user_id` and `crew_id`, with a boolean `visible` column; toggle changes SHALL be persisted immediately.
5. WHEN a user joins a new Crew, THE Calendar_Service SHALL default the new Crew's toggle state to on.
6. WHEN a user leaves or is removed from a Crew, THE App SHALL remove that Crew's toggle from the Combined_View and hide its entries; the `calendar_preferences` row for that Crew SHALL be soft-deleted.

---

### Requirement 11: Tapping a Calendar Entry — Navigation

**User Story:** As a user, I want tapping any calendar entry to take me to the right place in the app, so that I can get more context without having to search for it manually.

#### Acceptance Criteria

1. WHEN a user taps a Saved_Event entry in the Combined_View, THE App SHALL navigate to the detail view of the associated Event_Group.
2. WHEN a user taps a Checkin_Reminder entry in the Combined_View, THE App SHALL navigate to the Check-in tab.
3. WHEN a user taps a FitCheck_Reminder entry in the Combined_View, THE App SHALL navigate to the detail view of the associated Fit_Check_Post.
4. WHEN a user taps a `crew_entry` Personal_Reminder (copied from a Crew_Calendar_Entry) in the Combined_View, THE App SHALL navigate to the Crew Calendar tab for the source Crew.
5. WHEN a user taps a `general` Personal_Reminder in the Combined_View, THE App SHALL display a reminder detail sheet showing `title`, `reminder_at`, `category` (if set), and `note` (if set), with Edit and Delete actions.
6. WHEN a user taps a Crew_Calendar_Entry directly in the Combined_View (not a personal copy), THE App SHALL display an entry detail sheet showing `title`, `entry_at`, `description` (if set), `coarse_area` (if set), and an "Add to my calendar" button for members, with Edit and Delete actions visible only to admins/owners.
7. IF the target of a navigation action (Event_Group, Fit_Check_Post) has been soft-deleted, THE App SHALL display a message: "This content is no longer available 💨" and SHALL NOT navigate to a broken or empty detail view.

---

### Requirement 12: Privacy — No Location Beyond Coarse Area, No Sensitive Notification Payloads

**User Story:** As a user, I want the app to never store precise location data in the calendar and never expose sensitive content in push notification payloads, so that my data is handled safely.

#### Acceptance Criteria

1. THE Calendar_Service SHALL NOT store GPS coordinates, map pins, IP-derived location, or any value matching a GPS coordinate pattern in any calendar table (`personal_reminders`, `saved_events`, `crew_calendar_entries`, `calendar_preferences`).
2. WHEN a push notification is dispatched for any reminder type, THE Notification_Service SHALL include only a generic, non-sensitive message in the notification payload; `title`, `note`, `category`, and any location-related fields SHALL NOT be included in the payload.
3. THE App SHALL NOT render a map, map pin, geocoding result, or GPS-derived location on any calendar screen; `coarse_area` values SHALL be displayed as plain text only.
4. THE App SHALL display a location input for `coarse_area` as a free-text field; THE App SHALL NOT include a map picker, GPS autofill, or any device-location-sensing UI element anywhere in the calendar feature.

---

### Requirement 13: RLS Policies

**User Story:** As a product owner, I want Row Level Security policies on all calendar tables — verifying that a non-member cannot read another Crew's calendar entries, and a non-owner cannot read another user's personal reminders — so that the calendar privacy model is enforced at the database layer.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on all tables introduced by this spec: `personal_reminders`, `saved_events`, `crew_calendar_entries`, `calendar_preferences`.
2. WHILE a user is authenticated, THE App SHALL allow that user to read, insert, update, and soft-delete only rows in `personal_reminders` where `user_id` equals their own authenticated user ID; all other access SHALL be denied by RLS.
3. WHILE a user is authenticated, THE App SHALL allow that user to read and soft-delete only rows in `saved_events` where `user_id` equals their own authenticated user ID; all other access SHALL be denied by RLS.
4. WHILE a user is authenticated, THE App SHALL allow that user to read rows in `crew_calendar_entries` only for Crews in which they are an active Crew_Member (`crew_memberships.status = 'active'`); this policy SHALL be enforced at the database layer via RLS.
5. THE App SHALL allow insert, update, and soft-delete on `crew_calendar_entries` only for users whose Crew role is `admin` or `owner` for the relevant Crew; `member`-role users SHALL receive no write access, enforced via RLS.
6. THE App SHALL deny all access to all calendar tables for unauthenticated requests.
7. WHEN a user's Crew membership status changes to a non-active state (e.g., left, removed), THE App SHALL immediately cease returning `crew_calendar_entries` for that Crew to that user; this exclusion SHALL be enforced by the RLS policy on `crew_calendar_entries` without any application-layer cache flush being required for correctness.
8. THE App SHALL allow a user to read and write only their own rows in `calendar_preferences`; other users' preferences SHALL be invisible via RLS.

---

### Requirement 14: RLS Isolation Tests

**User Story:** As a developer, I want automated tests verifying that a non-member cannot read another Crew's calendar entries, and a non-owner cannot read another user's personal reminders, so that the RLS policies are continuously verified and privacy regressions are caught immediately.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when a user who is NOT an active member of a given Crew queries `crew_calendar_entries` for that Crew, the result set is empty (zero rows).
2. THE test suite SHALL include a Vitest unit test verifying: when an unauthenticated client queries any calendar table (`personal_reminders`, `saved_events`, `crew_calendar_entries`, `calendar_preferences`), the result set is empty or an authorisation error is returned.
3. THE test suite SHALL include a Vitest unit test verifying: when user A queries `personal_reminders` using their own authenticated JWT, they receive their own rows and zero rows belonging to user B.
4. THE test suite SHALL include a Vitest unit test verifying: when a user with the `member` role in a Crew attempts to insert a `crew_calendar_entries` row for that Crew, the insert is rejected with an authorisation error.
5. THE test suite SHALL include a Vitest unit test verifying: when a Crew Admin inserts a `crew_calendar_entries` row for their Crew, an active member of the same Crew can read that row.
6. THE test suite SHALL include a Vitest unit test verifying: when a user's Crew membership status is set to a non-active value (e.g., `left`), a subsequent query for `crew_calendar_entries` of that Crew returns zero rows for that user.
7. THE test suite SHALL include a round-trip property: FOR ALL Personal_Reminders created by user A, a query using user B's authenticated JWT SHALL return zero rows, regardless of the reminder's `title`, `category`, `reminder_type`, or `reminder_at` value. (Property: personal reminder isolation holds for all reminder contents and types)
8. THE test suite SHALL include a round-trip property: FOR ALL `crew_calendar_entries` rows created by an admin in Crew C, a query by any user who is not an active member of Crew C SHALL return zero rows, regardless of how many entries exist in Crew C. (Property: Crew calendar isolation holds for all entry counts and contents)
9. THE test suite SHALL include a Playwright end-to-end test that: signs in as user A (member of Crew C), confirms they can see Crew C's calendar entries in the Combined_View; then signs in as user B (not a member of Crew C) and confirms they see zero entries from Crew C in their Combined_View.

---

### Requirement 15: Notification Delivery Tests

**User Story:** As a developer, I want automated tests for reminder notification delivery logic, so that reminder firing, cancellation, and payload safety are continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when a `general` Personal_Reminder's `reminder_at` is reached, the Notification_Service is called exactly once for the owning user with a payload that does not contain the reminder's `title`, `note`, or `category`.
2. THE test suite SHALL include a Vitest unit test verifying: when a Checkin_Reminder fires, the notification payload contains the string "Time to start your check-in 💛" and nothing else sensitive.
3. THE test suite SHALL include a Vitest unit test verifying: when a FitCheck_Reminder fires, the notification payload does not contain the poll question, photo description, or any content from the `fit_check_posts` row.
4. THE test suite SHALL include a Vitest unit test verifying: when a Personal_Reminder is soft-deleted before `reminder_at` is reached, the Notification_Service does NOT dispatch a notification for that reminder.
5. THE test suite SHALL include a Vitest unit test verifying: when a FitCheck_Reminder is soft-deleted (because the associated Fit_Check_Post was deleted), the Notification_Service does NOT dispatch a notification for that reminder.
6. THE test suite SHALL include a property-based test: FOR ALL Personal_Reminders with `deleted_at IS NULL` and `reminder_at ≤ now`, the Notification_Service SHALL have dispatched exactly one notification per reminder; FOR ALL Personal_Reminders with `deleted_at IS NOT NULL`, zero notifications SHALL have been dispatched after the deletion timestamp. (Property: notification fire-exactly-once and cancelled-on-delete invariants hold across all reminder states)

---

### Requirement 16: Combined View Aggregation Tests

**User Story:** As a developer, I want automated tests for the combined calendar aggregation logic, so that source merging, colour assignment, toggle filtering, and navigation targets are continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: the Combined_View aggregation returns Personal_Reminders, Saved_Events, and Crew_Calendar_Entries for all Crews with toggle = on, and excludes entries from Crews with toggle = off.
2. THE test suite SHALL include a Vitest unit test verifying: soft-deleted Personal_Reminders, soft-deleted Saved_Events, and soft-deleted Crew_Calendar_Entries are excluded from the aggregation result.
3. THE test suite SHALL include a Vitest unit test verifying: when a user belongs to N Crews, the Calendar_Service assigns a distinct Source_Colour to each Crew from the Colour_Palette, cycling back to the start of the palette when N exceeds the palette size.
4. THE test suite SHALL include a Vitest unit test verifying: a Saved_Event whose associated Event_Group has been soft-deleted is excluded from the aggregation result.
5. THE test suite SHALL include a round-trip property: FOR ALL combinations of Personal_Reminders, Saved_Events, and Crew_Calendar_Entries stored for a user with all toggles on, the count of entries returned by the Combined_View aggregation SHALL equal the sum of the counts of each non-deleted source. (Property: aggregation is lossless and complete — no entries dropped or duplicated across any combination of sources)
