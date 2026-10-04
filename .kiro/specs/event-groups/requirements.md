# Requirements Document

## Introduction

Event Groups is a community feature of DivaCrew that lets verified members create short-lived group spaces tied to a real-world event — a concert, a march, a college fest, a meetup. Each event group lives inside one or more Crews and is discoverable by Crew members. It has a defined end time; after the event ends, it auto-archives (read-only) and its chat history is deleted on a schedule.

The feature includes: a group chat powered by Supabase Realtime with messages, replies, and image sharing; pinned organiser announcements with a "Verified information" trust label; event discovery within a Crew and a "Happening soon" section; and a non-removable safety card pinned to every group. Organiser moderation tools (remove member, mute) and report/block everywhere complete the set.

This spec builds on:
- **foundation-auth**: authenticated profiles, `verification_status`, `age_bracket`, block list, privacy settings.
- **crews**: Crew structure, `crew_memberships`, roles (`owner`/`admin`/`member`), RLS on Crew content. Event groups are scoped to a Crew — they are not globally public.
- **feed-posts**: image processing pipeline (`Image_Processor`) — EXIF strip, compress, private buckets, signed URLs. Reused for chat image uploads.
- **fit-check**: configurable scheduled jobs pattern (`Poll_Closer`) — reused as the pattern for `Auto_Archiver` and `Message_Deleter` jobs.

The audience may include minors (16–17). All privacy-first rules apply. Location is coarse area name only — never coordinates. Never claim a place or event is "safe".

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Event_Group**: A temporary group space created inside a Crew, representing a real-world event. Has a title, description, coarse location, start date/time, and end date/time.
- **Event_Group_Service**: The server-side component in `/lib/events` responsible for creating, fetching, updating, and soft-deleting event groups, enforcing membership and access rules.
- **Chat_Service**: The server-side component in `/lib/events` that handles real-time message delivery, replies, and image sharing via Supabase Realtime.
- **Announcement_Service**: The server-side component in `/lib/events` that manages pinned announcements, including the "Organiser update" / "Member post" distinction and the "Verified information" label.
- **Auto_Archiver**: The server-side scheduled job that sets `archived_at` on Event_Groups where `end_time + 24 hours ≤ now` and `archived_at IS NULL`, making them read-only.
- **Message_Deleter**: The server-side scheduled job that hard-deletes chat message rows from `event_chat_messages` where the parent Event_Group has `archived_at IS NOT NULL` and `archived_at + 7 days ≤ now`.
- **Moderation_Service**: The shared server-side component (from `/lib/security`) handling reports, blocks, mutes, and member removal within event groups.
- **Image_Processor**: The shared image processing pipeline from the feed-posts spec (`/lib/feed`) — reused without modification for EXIF stripping, compression, private bucket storage, and signed URL generation for chat image uploads.
- **Organiser**: The verified member who created the Event_Group, or any Crew Admin/Owner who has organiser-level privileges within the group.
- **Group_Member**: A user who has joined an Event_Group and has an active membership record for it.
- **Event_Chat_Message**: A row in the `event_chat_messages` table representing a single chat message, which may be a plain text message, an image message, or a reply to another message.
- **Announcement**: A pinned post in an Event_Group created by an Organiser or a Group_Member, displayed above the chat. Has a type: `organiser_update` or `member_post`.
- **Verified_Information_Label**: A trust signal that can be applied only by an Organiser or Crew Admin/Owner to an Announcement, indicating that a source link has been attached. It is NOT a DivaCrew endorsement or a safety guarantee.
- **Safety_Card**: A non-removable pinned card displayed at the top of every Event_Group, containing: "Go with a friend, share your check-in. 112 for emergencies." It cannot be dismissed or removed by anyone, including Organisers.
- **Coarse_Location**: A neighbourhood or area name typed by the Organiser (e.g., "near CP", "Lajpat Nagar area") — never GPS coordinates, never a map pin.
- **Archived_Group**: An Event_Group whose `archived_at` is set. All chat and post interactions are disabled; the group is read-only.
- **Signed_URL**: A time-limited, authenticated URL from Supabase Storage granting access to a private-bucket image (TTL ≤ 1 hour), as defined in the feed-posts spec.
- **Crew**: A named group space as defined in the crews spec.
- **Crew_Member**: A user with an active membership record for a given Crew, as defined in the crews spec.
- **Profile**: A row in the `profiles` table as defined in the foundation-auth spec.
- **Verification_Status**: `unverified`, `pending`, or `verified` as defined in the foundation-auth spec.
- **Age_Bracket**: `minor` (under 18) or `adult` (18+) as defined in the foundation-auth spec.

---

## Requirements

### Requirement 1: Creating an Event Group

**User Story:** As a verified Crew member, I want to create an event group inside my Crew with a title, description, coarse location, and start/end time, so that my crewmates can find out about the event and organise together.

#### Acceptance Criteria

1. WHEN a verified Crew_Member submits an event group creation form, THE Event_Group_Service SHALL create an `event_groups` record containing: `crew_id`, `organiser_id`, `title` (3–100 characters), `description` (up to 500 characters), `coarse_location` (up to 100 characters), `start_time` (ISO 8601 datetime), `end_time` (ISO 8601 datetime), `created_at`, `archived_at` (null by default), and `deleted_at` (null by default).
2. THE Event_Group_Service SHALL validate that `end_time` is strictly after `start_time`; submissions where `end_time ≤ start_time` SHALL be rejected with a descriptive error.
3. THE Event_Group_Service SHALL validate that `start_time` is not in the past at the time of submission; submissions with a `start_time` more than 5 minutes before the current server time SHALL be rejected with a descriptive error.
4. THE Event_Group_Service SHALL validate that `coarse_location` is a non-empty string of at most 100 characters; it SHALL NOT accept coordinates, map pins, or any value matching a GPS coordinate pattern (e.g., decimal degree pairs).
5. IF a user whose `verification_status` is not `verified` attempts to create an event group, THEN THE Event_Group_Service SHALL reject the request with a descriptive error indicating verification is required.
6. IF a user who is not an active Crew_Member of the target Crew attempts to create an event group in that Crew, THEN THE Event_Group_Service SHALL reject the request with an authorisation error.
7. WHEN an event group is created successfully, THE Event_Group_Service SHALL automatically add the creating user as the Organiser with a membership record in `event_group_memberships` with role `organiser`.
8. WHEN an event group is created, THE Event_Group_Service SHALL automatically create and pin the Safety_Card as the first item in the group, with content: "Go with a friend, share your check-in. 112 for emergencies." The Safety_Card SHALL NOT be removable by any user or role.
9. WHEN an event group is created successfully, THE App SHALL navigate the user to the new Event_Group's detail view.

---

### Requirement 2: Joining an Event Group

**User Story:** As a Crew member, I want to join an event group with one tap, so that I can participate in the group chat and see announcements.

#### Acceptance Criteria

1. WHEN an active Crew_Member taps "Join" on an Event_Group in their Crew's event discovery section, THE Event_Group_Service SHALL create an `event_group_memberships` record with `user_id`, `event_group_id`, `role` = `member`, `status` = `active`, and `joined_at`.
2. THE Event_Group_Service SHALL enforce that a user can only join an Event_Group that belongs to a Crew in which they are an active Crew_Member; non-Crew_Members SHALL be rejected with an authorisation error.
3. THE Event_Group_Service SHALL enforce uniqueness: if an `event_group_memberships` record already exists for the user and group, THE Event_Group_Service SHALL not create a duplicate and SHALL return a descriptive error.
4. IF an Event_Group has `archived_at` set (is archived), THEN THE Event_Group_Service SHALL reject new join attempts with a descriptive message indicating the group has ended.
5. IF an Event_Group has been soft-deleted (`deleted_at` is not null), THEN THE Event_Group_Service SHALL reject join attempts with a descriptive error.
6. WHEN a Group_Member taps "Leave" on an Event_Group, THE Event_Group_Service SHALL set their `event_group_memberships` record `status` to `left`.
7. THE App SHALL display the current Group_Member count on the Event_Group card and detail view.

---

### Requirement 3: Event Group Chat — Real-Time Messaging

**User Story:** As a Group_Member, I want a real-time group chat inside the event group so that we can coordinate, share updates, and stay connected before and during the event.

#### Acceptance Criteria

1. WHEN a Group_Member sends a text message in the Event_Group chat, THE Chat_Service SHALL insert an `event_chat_messages` record containing: `event_group_id`, `author_id`, `content` (1–1000 characters), `message_type` (`text`), `reply_to_id` (null for top-level messages), `created_at`, and `deleted_at` (null by default).
2. THE App SHALL deliver new messages to all active Group_Members in real time using Supabase Realtime subscriptions; the chat window SHALL update without a page reload or manual refresh.
3. WHEN a Group_Member sends a reply to an existing message, THE Chat_Service SHALL insert an `event_chat_messages` record with `reply_to_id` set to the parent message's ID. Replies SHALL be limited to one level of nesting — a reply cannot itself receive replies.
4. THE App SHALL display replies visually indented under their parent message, showing the parent message's author nickname and the first 60 characters of the parent content as a preview.
5. WHEN a Group_Member sends an image in the chat, THE Chat_Service SHALL pass the image through the shared `Image_Processor` (EXIF strip, compress, private bucket storage) before inserting the message record with `message_type` = `image` and the resulting storage path.
6. THE App SHALL render chat images using Signed_URLs with a TTL of at most 1 hour; no direct public-bucket URL SHALL be used.
7. THE Chat_Service SHALL reject image uploads larger than 5 MB and SHALL return a descriptive error.
8. THE Chat_Service SHALL accept JPEG, PNG, and WebP image formats only; other formats SHALL be rejected with a descriptive error.
9. THE App SHALL display a report button on every chat message visible to the reader.
10. THE App SHALL display messages in ascending chronological order (oldest at top, newest at bottom).
11. WHEN a Group_Member deletes their own message, THE Chat_Service SHALL soft-delete the record by setting `deleted_at`, and THE App SHALL replace the message body with "Message removed 💨".
12. IF a Group_Member is muted, THEN THE Chat_Service SHALL reject new messages from that member with a descriptive error until the mute expires.
13. IF a user has blocked the author of a message, THE App SHALL replace the message content with "Hidden — blocked user" without removing the message slot.
14. WHILE an Event_Group is archived (`archived_at` is not null), THE Chat_Service SHALL reject all new message insertions for that group with a descriptive error indicating the group is read-only.

---

### Requirement 4: Pinned Announcements

**User Story:** As an Organiser, I want to post pinned announcements in the event group so that important updates are always visible at the top, separate from the general chat.

#### Acceptance Criteria

1. WHEN an Organiser creates an announcement, THE Announcement_Service SHALL insert an `event_announcements` record containing: `event_group_id`, `author_id`, `content` (1–1000 characters), `announcement_type` (`organiser_update` or `member_post`), `verified_information` (boolean, default `false`), `source_link` (nullable URL), `is_pinned` (boolean, default `true` for organiser-created announcements), `created_at`, and `deleted_at` (null by default).
2. THE App SHALL display announcements in a dedicated section above the chat, sorted with pinned items first and then by `created_at` descending.
3. WHEN an Organiser creates an announcement, THE Announcement_Service SHALL set `announcement_type` to `organiser_update` automatically; the Organiser SHALL NOT be able to set it to `member_post`.
4. WHEN a Group_Member (non-Organiser) creates an announcement, THE Announcement_Service SHALL set `announcement_type` to `member_post`; the member SHALL NOT be able to set it to `organiser_update`.
5. THE App SHALL display the `announcement_type` label visibly on every announcement card: "Organiser update" for `organiser_update` and "Member post" for `member_post`.
6. WHEN an Organiser or Crew Admin/Owner applies the Verified_Information_Label to an announcement, THE Announcement_Service SHALL set `verified_information` to `true` and SHALL require a non-empty `source_link` (a valid URL); requests without a valid source link SHALL be rejected with a descriptive error.
7. THE App SHALL display the Verified_Information_Label on labelled announcements with the text "Verified information — source linked" and a visible link to the `source_link` URL.
8. THE App SHALL display a non-removable disclaimer alongside every Verified_Information_Label: "This label means a source was attached. It is not a DivaCrew endorsement or safety guarantee."
9. THE App SHALL NEVER display language suggesting that a Verified_Information_Label means the information is confirmed as factually true or that any person or place is safe.
10. THE Announcement_Service SHALL allow only Organisers and Crew Admins/Owners to apply or remove the Verified_Information_Label; Group_Members who attempt this action SHALL receive an authorisation error.
11. WHILE an Event_Group is archived, THE Announcement_Service SHALL reject new announcements for that group with a descriptive error.
12. THE App SHALL display a report button on every announcement visible to the reader.

---

### Requirement 5: Safety Card

**User Story:** As a product owner, I want a non-removable safety card pinned at the top of every event group, so that members always have immediate access to safety basics and emergency contact information.

#### Acceptance Criteria

1. THE Event_Group_Service SHALL automatically create a Safety_Card record in `event_announcements` at the time of event group creation, with `content` = "Go with a friend, share your check-in. 112 for emergencies.", `is_pinned` = `true`, `announcement_type` = `organiser_update`, and a system-generated `author_id` representing DivaCrew (not the Organiser).
2. THE App SHALL render the Safety_Card at the very top of the Event_Group's announcement section, above all other pinned and unpinned announcements.
3. THE App SHALL NOT render a delete, unpin, or dismiss control on the Safety_Card for any user or role, including Organisers and Crew Admins/Owners.
4. THE Event_Group_Service SHALL reject any request to delete, unpin, or modify the Safety_Card record, regardless of the requesting user's role, with a descriptive error.
5. THE App SHALL NOT include "safe" language in or adjacent to the Safety_Card; the card SHALL NOT imply that attending the event or sharing a check-in guarantees safety.
6. THE App SHALL render the Safety_Card text in a visually distinct style (e.g., a warm-coloured border or icon) that makes it immediately recognisable as a safety notice.

---

### Requirement 6: Event Discovery within a Crew

**User Story:** As a Crew member, I want to browse upcoming event groups inside my Crew and see a "Happening soon" section, so that I can find events relevant to my community.

#### Acceptance Criteria

1. WHEN a Crew_Member opens the Events tab of a Crew, THE Event_Group_Service SHALL return a paginated list of active (non-deleted, non-archived) Event_Groups for that Crew, ordered by `start_time` ascending.
2. THE App SHALL display a "Happening soon" section at the top of the Events tab showing Event_Groups whose `start_time` is within the next 48 hours, ordered by `start_time` ascending.
3. THE Event_Group_Service SHALL use cursor-based pagination; each response SHALL include a `next_cursor` value, and the client SHALL pass this cursor to retrieve the next page, with a maximum of 20 Event_Groups per page.
4. THE App SHALL display for each Event_Group card: title, `coarse_location`, `start_time` (formatted as human-readable date and time, e.g., "Sat 14 Aug, 6:00 PM"), Group_Member count, and a "Join" or "Joined" button based on the viewer's membership status.
5. THE App SHALL NOT display GPS coordinates, map pins, or any location detail beyond the Organiser-entered `coarse_location` string.
6. WHEN the Events tab has no active Event_Groups, THE App SHALL display an Empty_State with copy such as "No events yet — start one for your crew 🎉".
7. THE Event_Group_Service SHALL enforce RLS: a user SHALL NOT receive Event_Groups for a Crew they are not an active Crew_Member of, even if a direct URL is accessed.
8. THE App SHALL display archived Event_Groups in a separate "Past events" section below the active list, clearly labelled "Ended", as read-only entries.
9. IF an Event_Group has been soft-deleted, THE Event_Group_Service SHALL exclude it from all discovery responses.

---

### Requirement 7: Organiser Moderation Tools

**User Story:** As an Organiser, I want to remove members who are causing problems and mute disruptive members, so that the event group stays safe and welcoming.

#### Acceptance Criteria

1. WHEN an Organiser taps "Remove from group" on a Group_Member's profile within the Event_Group, THE Moderation_Service SHALL set that member's `event_group_memberships` record `status` to `removed`; the removed member SHALL immediately lose access to the group's chat and announcements.
2. WHEN an Organiser mutes a Group_Member, THE Moderation_Service SHALL create a mute record with `event_group_id`, `muted_user_id`, `muted_by`, and `muted_until` timestamp; THE Chat_Service SHALL reject new messages from that member until `muted_until` has elapsed.
3. THE Moderation_Service SHALL enforce that only Organisers and Crew Admins/Owners can remove or mute Group_Members; Member-role requests SHALL be rejected with an authorisation error.
4. THE App SHALL display a "Remove from group" and "Mute" option on every Group_Member's profile within the Event_Group, visible only to Organisers and Crew Admins/Owners.
5. THE Moderation_Service SHALL NOT allow an Organiser to remove or mute a Crew Admin or Owner.
6. WHEN a Group_Member is removed, THE App SHALL remove their messages from the Organiser's view via a soft-delete flag (`hidden_by_removal` = `true`) but SHALL NOT hard-delete the message rows.
7. THE App SHALL display a report button on every Group_Member profile visible within the Event_Group member list.

---

### Requirement 8: Report and Block Everywhere

**User Story:** As a Group_Member, I want to report any message, announcement, or member in the event group, and block users whose content I find harmful, so that I stay in control of my experience.

#### Acceptance Criteria

1. THE App SHALL display a report button on every `event_chat_messages` row, every `event_announcements` row, and every Group_Member profile visible within the Event_Group.
2. WHEN a user submits a report, THE Moderation_Service SHALL create a report record containing: `reporter_id`, `reported_content_id`, `content_type` (one of `event_message`, `event_announcement`, `event_group_member`, `event_group`), `reason`, and `created_at`.
3. THE App SHALL display confirmation after a report is submitted: "We got it — thanks for looking out 💛".
4. WHEN a user blocks another user (as defined in the foundation-auth spec), THE App SHALL hide that user's messages, announcements, and profile throughout the Event_Group context without removing their slots from the thread.
5. THE App SHALL NOT display the report or block option on the user's own content or profile.
6. WHEN a message or announcement is reported five or more times by distinct users, THE Moderation_Service SHALL flag it for admin review by setting `flagged_for_review` = `true`.

---

### Requirement 9: Auto-Archive Job

**User Story:** As a product owner, I want event groups to automatically become read-only 24 hours after the event ends, so that the space is preserved briefly for wrap-up but does not stay active indefinitely.

#### Acceptance Criteria

1. THE Auto_Archiver SHALL run on a scheduled basis at a minimum interval of every 15 minutes and SHALL set `archived_at` to the current timestamp on all `event_groups` rows where `end_time + 24 hours ≤ now` and `archived_at IS NULL`.
2. WHEN `archived_at` is set on an Event_Group, THE Chat_Service SHALL reject all new message insertions for that group and THE Announcement_Service SHALL reject all new announcements, returning a descriptive error to the client.
3. THE App SHALL display a visible banner in archived Event_Groups: "This event has ended. The group is now read-only."
4. THE App SHALL allow Group_Members to read all existing messages and announcements in an archived group.
5. THE Event_Group_Service SHALL use a server-side configuration value `ARCHIVE_DELAY_HOURS` (default 24) to compute the archive threshold at job-run time; changing this value SHALL affect subsequent job runs without modifying existing `archived_at` timestamps.
6. IF `ARCHIVE_DELAY_HOURS` is set to a value less than 1 or greater than 168 (7 days), THE Event_Group_Service SHALL reject the configuration at startup with a descriptive error and SHALL NOT start.
7. WHEN an Event_Group is archived, THE App SHALL update its status label in the Events tab to "Ended" without requiring a page reload by the user.

---

### Requirement 10: Message Deletion Job

**User Story:** As a product owner, I want all chat messages in an archived event group to be permanently deleted 7 days after archiving, so that ephemeral event chat data does not accumulate indefinitely.

#### Acceptance Criteria

1. THE Message_Deleter SHALL run on a scheduled basis at a minimum interval of every 60 minutes and SHALL hard-delete all rows in `event_chat_messages` where the associated `event_groups` row has `archived_at IS NOT NULL` and `archived_at + 7 days ≤ now`.
2. THE Message_Deleter SHALL hard-delete message rows (physical removal, not soft-delete), because the data retention purpose has been fulfilled.
3. THE Message_Deleter SHALL NOT delete `event_announcements` rows; announcements are retained as a record of what was communicated.
4. THE Event_Group_Service SHALL use a server-side configuration value `MESSAGE_RETENTION_DAYS` (default 7) to compute the deletion threshold at job-run time; changing this value SHALL affect subsequent job runs without retroactively changing already-scheduled deletions.
5. IF `MESSAGE_RETENTION_DAYS` is set to a value less than 1 or greater than 30, THE Event_Group_Service SHALL reject the configuration at startup with a descriptive error and SHALL NOT start.
6. WHEN the Message_Deleter deletes messages, THE App SHALL display "Chat history has been deleted" as a system message in the archived group's chat view, replacing the message list.

---

### Requirement 11: Location Privacy

**User Story:** As a user, I want event group locations to be expressed as area names only, never as GPS coordinates or precise addresses, so that my privacy and the privacy of others attending is protected.

#### Acceptance Criteria

1. THE Event_Group_Service SHALL validate that `coarse_location` does not match a GPS coordinate pattern (decimal degrees such as `28.6139, 77.2090` or DMS notation); submissions matching this pattern SHALL be rejected with a descriptive error: "Please enter an area name, not coordinates — for example 'near CP' or 'Lajpat Nagar area'."
2. THE App SHALL provide a free-text input field for `coarse_location` with a placeholder such as "Area or neighbourhood (e.g. near CP, Lajpat Nagar area)"; THE App SHALL NOT include a map picker, GPS autofill, or any location-sensing UI element.
3. THE Event_Group_Service SHALL NOT store or log any GPS coordinates, device location signals, or IP-derived location in association with an event group record.
4. THE App SHALL display `coarse_location` as plain text on all Event_Group cards and detail views; no map rendering, map embed, or geocoding SHALL be applied to this value.
5. THE App SHALL display a notice beneath the location input during creation: "Use a general area name — never your exact address."

---

### Requirement 12: RLS Policies for Event Groups

**User Story:** As a product owner, I want Row Level Security policies on all event group tables so that only Crew members can discover event groups, and only Group_Members can read chat messages, ensuring content is never exposed beyond the intended audience.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on all tables introduced by this spec: `event_groups`, `event_group_memberships`, `event_chat_messages`, `event_announcements`, `event_group_mutes`, `event_group_reports`.
2. WHILE a user is authenticated, THE Event_Group_Service SHALL only return `event_groups` rows for Crews in which the user is an active Crew_Member — this policy SHALL be enforced at the database layer via RLS.
3. WHILE a user is authenticated and is an active Group_Member, THE Chat_Service SHALL only return `event_chat_messages` rows for Event_Groups the user is a member of — this policy SHALL be enforced via RLS.
4. THE App SHALL NOT allow a user to insert, update, or delete `event_group_memberships` rows directly; all membership mutations SHALL be performed via trusted server-side functions.
5. THE App SHALL NOT allow any client to insert directly into `event_group_reports`; all report inserts SHALL be performed via a trusted server-side function.
6. THE App SHALL deny all access to all event group tables for unauthenticated requests.
7. WHEN a user's Crew membership is revoked or set to a non-active status, THE Event_Group_Service SHALL immediately exclude all Event_Groups for that Crew from subsequent requests by that user.
8. WHEN a Group_Member's `event_group_memberships` status is set to `removed`, THE Chat_Service SHALL immediately return an empty result for any message query by that user for that group.

---

### Requirement 13: Event Group Lifecycle — Edit and Delete

**User Story:** As an Organiser, I want to edit my event group's details and delete the group if plans change, so that I keep my crew informed and can remove groups that are no longer happening.

#### Acceptance Criteria

1. THE App SHALL display an "Edit" option on the Event_Group detail view visible only to the Organiser and Crew Admins/Owners.
2. WHEN an Organiser updates an event group, THE Event_Group_Service SHALL allow updates to `title`, `description`, `coarse_location`, `start_time`, and `end_time`; the same validation rules from Requirement 1 SHALL apply to updated values.
3. WHEN an event group is updated, THE Event_Group_Service SHALL record the update timestamp in an `updated_at` field.
4. THE App SHALL display a "Delete group" option visible only to the Organiser and Crew Admins/Owners.
5. WHEN an Organiser or Crew Admin/Owner taps "Delete group", THE App SHALL display a confirmation prompt before proceeding.
6. WHEN confirmed, THE Event_Group_Service SHALL soft-delete the record by setting `deleted_at` to the current timestamp; the row SHALL NOT be physically removed.
7. WHEN an event group is soft-deleted, THE App SHALL immediately remove it from the Crew's Events tab discovery list without a page reload.
8. THE Event_Group_Service SHALL enforce that only the Organiser or a Crew Admin/Owner may soft-delete an event group; all other deletion attempts SHALL be rejected with an authorisation error.
9. WHEN an event group is archived (`archived_at` is set), THE Event_Group_Service SHALL allow edits to `title` and `description` only by the Organiser and Crew Admins/Owners; edits to `start_time`, `end_time`, and `coarse_location` SHALL be rejected with a descriptive error on archived groups.

---

### Requirement 14: Auto-Archive and Message Deletion Job Tests

**User Story:** As a developer, I want automated tests for the Auto_Archiver and Message_Deleter scheduled jobs so that the archive and deletion logic is continuously verified and regressions are caught immediately.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when the Auto_Archiver runs for an event group whose `end_time + ARCHIVE_DELAY_HOURS ≤ now` and `archived_at IS NULL`, the group's `archived_at` field is set to the current timestamp.
2. THE test suite SHALL include a Vitest unit test verifying: when the Auto_Archiver runs for an event group whose `end_time + ARCHIVE_DELAY_HOURS > now`, the group's `archived_at` remains NULL.
3. THE test suite SHALL include a Vitest unit test verifying: when the Auto_Archiver runs for an event group that already has `archived_at` set, the job does not overwrite the existing `archived_at` value.
4. THE test suite SHALL include a Vitest unit test verifying: after `archived_at` is set on an event group, any attempt to insert a new chat message for that group is rejected with a descriptive error.
5. THE test suite SHALL include a Vitest unit test verifying: when the Message_Deleter runs for an archived event group where `archived_at + MESSAGE_RETENTION_DAYS ≤ now`, all rows in `event_chat_messages` for that group are hard-deleted.
6. THE test suite SHALL include a Vitest unit test verifying: when the Message_Deleter runs for an archived event group where `archived_at + MESSAGE_RETENTION_DAYS > now`, no messages are deleted.
7. THE test suite SHALL include a Vitest unit test verifying: the Message_Deleter does NOT delete any rows from `event_announcements`, even when message deletion for the same group is triggered.
8. THE test suite SHALL include a round-trip property: FOR ALL event groups created with any valid `end_time` and `ARCHIVE_DELAY_HOURS` configuration value within the allowed range [1, 168], the Auto_Archiver run at time `end_time + ARCHIVE_DELAY_HOURS + ε` SHALL produce `archived_at IS NOT NULL`, and a run at time `end_time + ARCHIVE_DELAY_HOURS - ε` SHALL produce `archived_at IS NULL`. (Property: archive threshold is exact and consistent for all valid configurations)
9. THE test suite SHALL include a round-trip property: FOR ALL event groups archived with any valid `MESSAGE_RETENTION_DAYS` configuration value within the allowed range [1, 30], the Message_Deleter run at time `archived_at + MESSAGE_RETENTION_DAYS + ε` SHALL result in zero rows in `event_chat_messages` for that group, and a run at `archived_at + MESSAGE_RETENTION_DAYS - ε` SHALL leave all message rows intact. (Property: deletion threshold is exact and consistent for all valid retention configurations)
10. THE test suite SHALL include a Vitest unit test verifying: changing `ARCHIVE_DELAY_HOURS` to a value outside [1, 168] causes the Event_Group_Service to reject the configuration and refuse to start.
11. THE test suite SHALL include a Vitest unit test verifying: changing `MESSAGE_RETENTION_DAYS` to a value outside [1, 30] causes the Event_Group_Service to reject the configuration and refuse to start.
12. THE test suite SHALL include a Playwright end-to-end test simulating: an Organiser creates an event group; the Auto_Archiver is triggered for that group; a Group_Member attempts to send a chat message and receives a read-only error; the Message_Deleter is triggered; the chat view displays "Chat history has been deleted".

---

### Requirement 15: Chat Real-Time Delivery and Image Handling Tests

**User Story:** As a developer, I want automated tests for real-time message delivery and chat image handling so that the Supabase Realtime integration and image privacy pipeline are continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: a text message inserted into `event_chat_messages` by a Group_Member is returned by a subsequent query for that group's messages, in ascending `created_at` order.
2. THE test suite SHALL include a Vitest unit test verifying: a chat image upload is passed through the `Image_Processor` before the message record is created; no unprocessed image is stored in the bucket.
3. THE test suite SHALL include a Vitest unit test verifying: a chat image request returns a Signed_URL with TTL ≤ 1 hour, not a direct public bucket URL.
4. THE test suite SHALL include a Vitest unit test verifying: when a user who is not a Group_Member queries `event_chat_messages` for a group, the result set is empty (RLS enforcement).
5. THE test suite SHALL include a round-trip property: FOR ALL valid text messages (any non-empty string up to 1000 characters) sent by a Group_Member in an active (non-archived) group, the message SHALL be retrievable by the same user and by any other active Group_Member, in ascending order, with content unchanged. (Property: message persistence and ordering are invariant to message content)
6. THE test suite SHALL include a Vitest unit test verifying: a muted Group_Member's attempt to send a chat message is rejected with a descriptive error.
7. THE test suite SHALL include a Vitest unit test verifying: a removed Group_Member's attempt to query chat messages returns an empty result set.
