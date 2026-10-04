# Requirements Document

## Introduction

Crews is the community backbone of DivaCrew — a space where girls can find their people, start group conversations, share posts, and organise around shared interests, colleges, cities, or careers. A Crew is either public (any verified user can join) or private (join by invite or approval). Each Crew has a structured tab layout (Posts, Chat, Polls, Events, Resources), with Posts fully implemented in this spec and the remaining tabs as placeholders. A discovery page with search, category filters, and personalised suggestions helps users find relevant Crews. All data access is enforced through Supabase Row Level Security to ensure non-members cannot read private Crew content.

This spec builds on the foundation-auth spec. Users are already authenticated and have profiles with a `verification_status` when they interact with Crews.

---

## Glossary

- **Crew**: A named group space within DivaCrew, with a defined visibility, category, member list, and content tabs.
- **Crew_Service**: The server-side component (in `/lib/crews`) responsible for Crew creation, membership mutations, and discovery logic.
- **Post_Service**: The server-side component responsible for creating, fetching, reporting, and deleting Crew posts.
- **Membership_Service**: The server-side component that handles join requests, approvals, invites, role changes, and removals.
- **Discovery_Service**: The server-side component that returns search results and personalised Crew suggestions.
- **Crew_Member**: A user who has an accepted membership record for a given Crew (role: `owner`, `admin`, or `member`).
- **Owner**: The Crew_Member who created the Crew; holds the highest privilege level.
- **Admin**: A Crew_Member elevated by the Owner; can approve join requests, mute, remove members, pin posts, and edit Crew rules.
- **Member**: A standard Crew_Member with read and post access.
- **Join_Request**: A pending record created when a verified user applies to join a private Crew.
- **Crew_Post**: A piece of user-generated content published inside a Crew's Posts tab.
- **Pinned_Post**: A Crew_Post that an Admin or Owner has elevated to appear at the top of the Posts tab.
- **Crew_Invite**: A direct invitation from an Owner or Admin to a specific verified user to join a private Crew.
- **Visibility**: The access model of a Crew — either `public` (any verified user may join) or `private` (join by approval or invite only).
- **Category**: A classification label for a Crew — one of `city`, `college`, `interest`, or `career`.
- **Suggestion_Score**: A numeric score computed by the Discovery_Service to rank Crews for a given user based on matching signals (shared Crews, tags, city).
- **Report**: A flag submitted by any authenticated user against a Crew, Crew_Post, or Crew_Member indicating potentially harmful or violating content.
- **Mute**: A moderation action by an Admin or Owner that prevents a Crew_Member from posting or commenting for a configurable duration.
- **Profile**: A row in the `profiles` table as defined in the foundation-auth spec.
- **Verification_Status**: The `verification_status` field on a Profile, with values `unverified`, `pending`, or `verified`, as defined in the foundation-auth spec.

---

## Requirements

### Requirement 1: Crew Creation

**User Story:** As a verified user, I want to create a Crew with a name, emoji, description, category, visibility, and rules, so that I can build a community space around something I care about.

#### Acceptance Criteria

1. WHEN a verified user submits a Crew creation form, THE Crew_Service SHALL create a new Crew record with the fields: `name`, `emoji`, `description`, `category`, `visibility`, and `rules`.
2. THE Crew_Service SHALL validate that `name` is between 3 and 50 characters and contains no prohibited characters.
3. THE Crew_Service SHALL validate that `description` is at most 300 characters.
4. THE Crew_Service SHALL validate that `category` is one of the four allowed values: `city`, `college`, `interest`, or `career`.
5. THE Crew_Service SHALL validate that `visibility` is one of the two allowed values: `public` or `private`.
6. WHEN a Crew is created, THE Crew_Service SHALL automatically add the creating user as the Crew's Owner with role `owner`.
7. WHEN a Crew is created, THE Crew_Service SHALL set the Crew's `member_count` to 1.
8. IF a user whose Verification_Status is not `verified` attempts to create a Crew, THEN THE Crew_Service SHALL reject the request with an error indicating verification is required.
9. THE Crew_Service SHALL enforce a maximum of 10 Crews created per user to prevent abuse.
10. WHEN a Crew is successfully created, THE App SHALL navigate the user to the new Crew's Posts tab.

---

### Requirement 2: Crew Membership — Public Crews

**User Story:** As a verified user, I want to join any public Crew instantly, so that I can participate without waiting for approval.

#### Acceptance Criteria

1. WHEN a verified user taps "Join" on a public Crew, THE Membership_Service SHALL create a membership record with role `member` and `status` = `active`.
2. WHEN a membership record is created, THE Crew_Service SHALL increment the Crew's `member_count` by 1.
3. IF a user whose Verification_Status is not `verified` attempts to join a public Crew, THEN THE Membership_Service SHALL reject the request with an error indicating verification is required.
4. IF a user who is already a Crew_Member attempts to join the same Crew again, THEN THE Membership_Service SHALL reject the request without creating a duplicate record.
5. WHEN a Crew_Member leaves a Crew, THE Membership_Service SHALL set the membership record's `status` to `left` and THE Crew_Service SHALL decrement the Crew's `member_count` by 1.
6. IF the Owner attempts to leave a Crew, THEN THE Membership_Service SHALL reject the request with a message instructing the Owner to transfer ownership or delete the Crew first.

---

### Requirement 3: Crew Membership — Private Crews

**User Story:** As a verified user, I want to request to join a private Crew or accept a direct invite, so that I can join communities that require approval.

#### Acceptance Criteria

1. WHEN a verified user taps "Request to Join" on a private Crew, THE Membership_Service SHALL create a Join_Request record with `status` = `pending`.
2. WHEN a Join_Request is pending, THE App SHALL display the request status to the requesting user on the Crew discovery card.
3. WHEN an Owner or Admin approves a Join_Request, THE Membership_Service SHALL update the Join_Request `status` to `approved`, create a membership record with role `member`, and increment the Crew's `member_count` by 1.
4. WHEN an Owner or Admin rejects a Join_Request, THE Membership_Service SHALL update the Join_Request `status` to `rejected` and the requesting user SHALL NOT gain access to the Crew.
5. WHEN an Owner or Admin sends a Crew_Invite to a verified user, THE Membership_Service SHALL create a Crew_Invite record with `status` = `pending`.
6. WHEN an invited user accepts a Crew_Invite, THE Membership_Service SHALL update the Crew_Invite `status` to `accepted`, create a membership record with role `member`, and increment the Crew's `member_count` by 1.
7. WHEN an invited user declines a Crew_Invite, THE Membership_Service SHALL update the Crew_Invite `status` to `declined` and no membership record SHALL be created.
8. IF a user who is already a Crew_Member attempts to submit a Join_Request or accept an invite to the same Crew, THEN THE Membership_Service SHALL reject the action without creating a duplicate record.

---

### Requirement 4: Crew Roles and Admin Moderation

**User Story:** As a Crew Owner or Admin, I want moderation tools to manage members and content, so that the Crew stays a safe and welcoming space.

#### Acceptance Criteria

1. THE App SHALL support three Crew roles in order of privilege: `owner` > `admin` > `member`.
2. WHEN an Owner promotes a Member to Admin, THE Membership_Service SHALL update the membership record's `role` to `admin`.
3. WHEN an Owner demotes an Admin to Member, THE Membership_Service SHALL update the membership record's `role` to `member`.
4. WHEN an Admin or Owner removes a Crew_Member, THE Membership_Service SHALL set the removed member's membership `status` to `removed` and THE Crew_Service SHALL decrement the `member_count` by 1.
5. WHEN an Admin or Owner mutes a Crew_Member, THE Membership_Service SHALL create a mute record with a `muted_until` timestamp, and THE Post_Service SHALL reject new posts or comments from that member until the mute expires.
6. WHEN an Admin or Owner pins a Crew_Post, THE Post_Service SHALL set the post's `is_pinned` flag to `true` and THE App SHALL display pinned posts at the top of the Posts tab.
7. WHEN an Admin or Owner edits the Crew rules, THE Crew_Service SHALL persist the updated `rules` field and record the editing user's ID and the update timestamp.
8. IF a Member attempts to perform an Admin-only action (promote, demote, remove, mute, pin, edit rules), THEN THE Crew_Service SHALL reject the request with an authorisation error.
9. WHEN an Owner transfers ownership to another Crew_Member, THE Membership_Service SHALL update the original Owner's role to `admin` and the new Owner's role to `owner`.

---

### Requirement 5: Crew Posts Tab

**User Story:** As a Crew_Member, I want to post text and images inside a Crew, so that I can share content with my crewmates.

#### Acceptance Criteria

1. WHEN a Crew_Member submits a post in the Posts tab, THE Post_Service SHALL create a Crew_Post record containing: `crew_id`, `author_id`, `content` (text up to 1000 characters), optional `image_urls` (up to 4 images), `created_at`, and `is_pinned` (default `false`).
2. THE Post_Service SHALL accept image uploads in JPEG, PNG, and WebP formats up to 5 MB per image and store them in Supabase Storage.
3. WHEN the Posts tab is loaded, THE App SHALL display posts in reverse-chronological order with pinned posts appearing above all non-pinned posts.
4. WHEN a Crew_Member deletes their own post, THE Post_Service SHALL soft-delete the record by setting a `deleted_at` timestamp and THE App SHALL no longer display the post.
5. WHEN an Admin or Owner deletes any post in their Crew, THE Post_Service SHALL soft-delete the record and record the moderating user's ID as `deleted_by`.
6. THE App SHALL display a report button on every Crew_Post visible to all authenticated users who can see the post.
7. WHEN a user submits a Report on a Crew_Post, THE Post_Service SHALL create a Report record containing: `reporter_id`, `post_id`, `reason`, and `created_at`.
8. IF a non-Crew_Member attempts to create, read, or interact with posts in a private Crew, THEN THE Post_Service SHALL reject the request with an authorisation error.
9. WHEN a Crew_Member views the Posts tab, THE App SHALL display a maximum of 30 posts per page and provide a mechanism to load additional posts.

---

### Requirement 6: Crew Tab Structure

**User Story:** As a Crew_Member, I want to see a clear tab layout inside a Crew, so that I can navigate between different types of content.

#### Acceptance Criteria

1. THE App SHALL render a tab bar inside every Crew with five tabs in this order: Posts, Chat, Polls, Events, Resources.
2. WHEN a user navigates to a Crew, THE App SHALL default to the Posts tab.
3. WHEN a user taps the Chat, Polls, Events, or Resources tab, THE App SHALL display a placeholder screen indicating the feature is coming soon.
4. THE App SHALL make the Posts tab fully functional as defined in Requirement 5.
5. THE tab bar SHALL be keyboard navigable and each tab SHALL have an accessible label readable by screen readers.
6. IF a non-Crew_Member navigates to a private Crew's URL directly, THEN THE App SHALL display only the Crew's public metadata (name, emoji, description, member count, category) and a "Request to Join" button; all tab content SHALL be hidden.

---

### Requirement 7: Crew Discovery Page

**User Story:** As a verified user, I want to search and browse Crews and see suggestions personalised to me, so that I can find communities that match my interests.

#### Acceptance Criteria

1. THE App SHALL provide a Crew discovery page accessible from the Crews tab in the Bottom_Nav.
2. WHEN a user enters a search query, THE Discovery_Service SHALL return Crews whose `name` or `description` matches the query, ordered by member count descending.
3. THE Discovery_Service SHALL support filtering by `category` (`city`, `college`, `interest`, `career`) and by city name.
4. WHEN a verified user opens the discovery page, THE Discovery_Service SHALL display a "Suggested for you" section containing up to 10 Crew suggestions ranked by Suggestion_Score.
5. THE Discovery_Service SHALL compute Suggestion_Score using the following signals in priority order: (1) the user shares at least one other Crew with existing members of the candidate Crew (+3 per shared Crew, capped at +9); (2) the candidate Crew's category matches a category of a Crew the user has already joined (+2); (3) the candidate Crew's city tag matches the user's city from their Profile (+2).
6. THE Discovery_Service SHALL exclude from suggestions any Crew the user is already a member of or has a pending Join_Request for.
7. WHEN search results or suggestions are returned, THE App SHALL display for each Crew: name, emoji, category, member count, and a join or request button appropriate to the Crew's visibility.
8. IF no search results are found, THE App SHALL display a message indicating no Crews matched the query.
9. THE Discovery_Service SHALL only return public Crews and private Crews whose name and metadata the user can see; the member list and posts of private Crews SHALL NOT be included in discovery results.

---

### Requirement 8: Private Crew Access Control (RLS)

**User Story:** As a product owner, I want Row Level Security policies ensuring non-members cannot read private Crew posts or member lists, so that private Crews are genuinely private.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on the `crews`, `crew_memberships`, `crew_posts`, `join_requests`, `crew_invites`, and `crew_reports` tables.
2. WHILE a user is authenticated, THE App SHALL allow any authenticated user to read the metadata columns (`name`, `emoji`, `description`, `category`, `visibility`, `member_count`, `rules`) of any Crew row regardless of visibility.
3. WHILE a user is authenticated and the Crew's `visibility` is `public`, THE App SHALL allow any authenticated user to read rows in `crew_memberships` and `crew_posts` for that Crew.
4. WHILE a user is authenticated and the Crew's `visibility` is `private`, THE App SHALL allow only confirmed Crew_Members to read rows in `crew_memberships` and `crew_posts` for that Crew.
5. THE App SHALL not allow any client to insert or update `crew_memberships` rows directly; all membership mutations SHALL be performed via server-side functions with the service role or a trusted RPC.
6. WHEN a user attempts to read `crew_posts` for a private Crew they are not a member of, THE App SHALL receive an empty result set (not an error) from Supabase, consistent with RLS row-filtering behaviour.
7. THE App SHALL deny all access to `crew_memberships`, `crew_posts`, `join_requests`, and `crew_invites` for unauthenticated requests.

---

### Requirement 9: Safety — Reporting and Blocking within Crews

**User Story:** As a Crew_Member, I want to report harmful content and block other members, so that I feel safe participating in a Crew.

#### Acceptance Criteria

1. THE App SHALL display a report button on every Crew_Post and on every Crew_Member's profile visible within the Crew member list.
2. WHEN a user submits a Report on a Crew_Member (within the Crew context), THE Crew_Service SHALL create a Report record containing: `reporter_id`, `reported_user_id`, `crew_id`, `reason`, and `created_at`.
3. WHEN a user blocks another user (as defined in the foundation-auth Settings spec), THE App SHALL hide that user's posts and profile within all Crew contexts the blocking user can access.
4. THE App SHALL not display the age bracket, exact profile details, or any PII of Crew_Members beyond nickname and avatar in the member list.
5. WHEN a Crew_Post or Crew_Member is reported, THE App SHALL display a confirmation to the reporter that the report has been received and will be reviewed.
6. WHERE a user's Age_Bracket is `minor`, THE App SHALL apply the same privacy defaults from the foundation-auth spec (DMs restricted, profile private) within Crew contexts and SHALL NOT display a minor's profile to non-connected users.

---

### Requirement 10: Non-Member Private Crew Access Tests

**User Story:** As a developer, I want automated tests proving that a non-member cannot read a private Crew's posts or member list, so that the RLS policies are continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test that verifies: when a Supabase query for `crew_posts` is executed with the JWT of a user who is not a member of a private Crew, the result set is empty.
2. THE test suite SHALL include a Vitest unit test that verifies: when a Supabase query for `crew_memberships` is executed with the JWT of a non-member of a private Crew, the result set is empty.
3. THE test suite SHALL verify that the same queries executed with the JWT of a confirmed Crew_Member of that private Crew return the expected rows.
4. THE test suite SHALL verify that a non-member can still read the metadata columns (`name`, `emoji`, `description`, `category`, `visibility`, `member_count`) of a private Crew.
5. THE test suite SHALL include a round-trip property: FOR ALL private Crews created by one user, a second user who has never joined that Crew SHALL receive an empty result set when querying `crew_posts` and `crew_memberships`, regardless of the post content or membership data stored. (Round-trip: create private Crew + add posts/members → query as non-member → assert empty result)
6. THE test suite SHALL include a Playwright end-to-end test that simulates a non-member navigating directly to a private Crew's URL, confirming that tab content is hidden and only public metadata and the "Request to Join" button are visible.

---

### Requirement 11: Crew Deletion and Lifecycle

**User Story:** As a Crew Owner, I want to delete a Crew I created, so that I can remove it when it is no longer needed.

#### Acceptance Criteria

1. WHEN a Crew Owner taps "Delete Crew", THE App SHALL display a confirmation screen describing that all posts, member records, and content will be permanently removed.
2. WHEN a Crew Owner confirms deletion, THE Crew_Service SHALL soft-delete the Crew by setting a `deleted_at` timestamp and THE App SHALL no longer display the Crew in discovery or to its members.
3. WHEN a Crew is soft-deleted, THE Crew_Service SHALL set the `status` of all active membership records for that Crew to `crew_deleted`.
4. IF a user navigates to the URL of a deleted Crew, THEN THE App SHALL display a message indicating the Crew no longer exists and offer a link to the discovery page.
5. THE Crew_Service SHALL allow only the Owner to delete a Crew; Admin and Member roles SHALL receive an authorisation error if they attempt deletion.
