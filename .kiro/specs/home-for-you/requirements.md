# Requirements Document

## Introduction

"For You" (internally "Your Crew") is the personalised home screen of DivaCrew — the first thing a user sees when they open the app (Feed tab in the bottom navigation). It replaces a plain chronological feed with a warm, curated experience: summary cards for activity happening inside the user's existing Crews, followed by a rule-based recommendation rail for new Crews and upcoming Events the user hasn't joined yet.

Recommendations use a transparent, additive scoring formula based on shared membership, category overlap, and city match — no ML, no embeddings, no sensitive attributes. Every recommendation carries a "Why am I seeing this?" label. Users can dismiss any recommendation and dismissals are respected in all future results. An optional AI-enhancement feature flag may replace the static reason label with a single LLM-generated sentence, using only crew names and tags.

Civic content (What Changed, Explain This) is never personalised; it appears identically for all users.

This spec builds on:
- **foundation-auth**: `profiles` (city field), `verification_status`, `age_bracket`, blocks table.
- **crews**: `crews` (name, category, tags), `crew_memberships`.
- **feed-posts**: crew posts (new-posts summary cards).
- **event-groups**: `event_groups` (upcoming events summary cards and recommendations).
- **crew-checkin**: check-in contact requests (check-in request summary cards).
- **moderation**: blocks table — blocked users must never appear in recommendations.

The audience may include minors (16–17). All privacy-first rules apply. No sensitive attributes (age bracket, city, religion, caste, health) are used for personalisation. City is used only as a low-sensitivity signal in the recommendation score, never surfaced back to the user or stored separately.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Home_Screen**: The screen rendered on the Feed tab when an authenticated user opens the app. Contains Summary_Cards followed by the Recommendation_Rail.
- **Home_Service**: The server-side component in `/lib/home` responsible for assembling the Home_Screen payload: fetching Summary_Cards and computing Recommendation_Rail items.
- **Scoring_Service**: The server-side component in `/lib/home` that computes the Suggestion_Score for each recommendation candidate using the additive scoring formula.
- **Dismissal_Service**: The server-side component in `/lib/home` that records and applies user dismissals of recommendations.
- **AI_Reason_Service**: The optional server-side component in `/lib/home` that, when the `HOME_AI_REASONS_ENABLED` flag is active, calls an LLM to generate a friendly one-line reason string for a recommendation.
- **Summary_Card**: A compact card displayed at the top of the Home_Screen summarising recent activity in one of four categories: new crew posts, upcoming events, check-in requests, or admin announcements.
- **Recommendation_Rail**: The scrollable section below Summary_Cards showing recommended Crews and Events the user has not joined, ranked by Suggestion_Score.
- **Recommendation_Item**: A single entry in the Recommendation_Rail. Has a type (`crew` or `event`), a Suggestion_Score, a Why_Label, and a dismiss control.
- **Suggestion_Score**: The numeric score (integer ≥ 0) computed by the Scoring_Service for a recommendation candidate. Higher is more relevant.
- **Why_Label**: A short, visible string on every Recommendation_Item explaining the strongest signal that drove the recommendation. Example: "3 people from Delhi Girlies are here".
- **AI_Why_Label**: A LLM-generated single sentence (≤ 20 words) replacing the static Why_Label when `HOME_AI_REASONS_ENABLED` is `true`. Generated from crew name, category, tags, and matching signals only.
- **Dismissal**: A user action that permanently hides a specific Recommendation_Item from the user's future results.
- **Candidate_Crew**: A verified, public Crew that the user is NOT currently a member of and has NOT dismissed, and whose organiser is not blocked by the user.
- **Candidate_Event**: An upcoming (non-archived, non-deleted) Event_Group that the user is NOT currently a member of and has NOT dismissed, and whose organiser is not blocked by the user.
- **Profile**: A row in the `profiles` table as defined in the foundation-auth spec.
- **Crew**: A named group space as defined in the crews spec.
- **Crew_Member**: A user with an active membership record for a Crew, as defined in the crews spec.
- **Event_Group**: A temporary event group space as defined in the event-groups spec.
- **Checkin_Request**: A contact request sent to the user in the crew-checkin feature (a `contact_requests` row with `recipient_id` = current user and `status` = `pending`).
- **Admin_Announcement**: A post in one of the user's Crews with `post_type` = `organiser_update` and `is_pinned` = `true`, posted by a Crew Admin or Owner within the last 7 days.
- **Blocked_User**: A user the current user has blocked, as recorded in the `blocks` table from the foundation-auth spec.

---

## Requirements

### Requirement 1: Home Screen Layout and Entry Point

**User Story:** As a DivaCrew member, I want a warm, personalised home screen when I open the app, so that I immediately see what's happening in my world without having to navigate around.

#### Acceptance Criteria

1. WHEN an authenticated user opens the app (Feed tab), THE App SHALL render the Home_Screen as the default view, comprising: (a) a Summary_Cards section at the top, and (b) a Recommendation_Rail below it.
2. THE App SHALL display the heading "Your Crew 💅" (or equivalent localised text) at the top of the Home_Screen.
3. WHEN the Home_Screen is loading, THE App SHALL display Skeleton placeholders for Summary_Cards and Recommendation_Rail items using DivaCrew's brand colours and a shimmer animation.
4. WHEN there are no Summary_Cards to display and no recommendations to show, THE App SHALL display a warm Empty_State with copy such as "It's quiet here — go find your crew 💜" and a link to the Crew discovery page.
5. THE App SHALL render the Home_Screen using Server Components or a Server Action for the initial payload to minimise client-side data fetching.
6. THE Home_Screen SHALL be keyboard navigable and meet WCAG 2.1 AA contrast requirements in both light and dark themes.

---

### Requirement 2: Summary Cards — New Crew Posts

**User Story:** As a Crew member, I want to see a summary card for new posts in my crews since my last visit, so that I know there's something to catch up on without having to open each Crew.

#### Acceptance Criteria

1. WHEN an authenticated user opens the Home_Screen, THE Home_Service SHALL query `crew_posts` for all Crews the user is an active member of and return the count of posts created after the user's `last_seen_at` timestamp.
2. WHEN there is at least one new post, THE App SHALL display a Summary_Card showing: the number of new posts, the names of up to 3 Crews with new content, and a tap target that navigates to the Feed tab's chronological view.
3. THE Home_Service SHALL exclude soft-deleted posts (`deleted_at IS NOT NULL`) and posts from blocked authors from the new-post count.
4. WHEN the user has no new posts since their last visit, THE App SHALL not display the new-posts Summary_Card.
5. THE Home_Service SHALL update the user's `last_seen_at` timestamp in `home_screen_state` when the Home_Screen is successfully loaded.

---

### Requirement 3: Summary Cards — Upcoming Events

**User Story:** As a Crew member, I want to see a summary card for events happening in the next 48 hours across all my crews, so that I don't miss something I'd want to join.

#### Acceptance Criteria

1. WHEN an authenticated user opens the Home_Screen, THE Home_Service SHALL query `event_groups` for all Crews the user is an active member of and return events whose `start_time` is within the next 48 hours and that are not archived or soft-deleted.
2. WHEN there is at least one upcoming event, THE App SHALL display a Summary_Card showing: the event title, the Crew name, the `start_time` formatted as a human-readable date and time (e.g., "Today, 6:00 PM" or "Sat 14 Aug, 6:00 PM"), and a tap target that navigates to the Event_Group detail view.
3. IF multiple events are upcoming, THE App SHALL display up to 3 events in a horizontally scrollable row within the Summary_Card, ordered by `start_time` ascending.
4. THE App SHALL NEVER display GPS coordinates or precise addresses in the events Summary_Card; only `coarse_location` text from the event-groups spec shall be shown.
5. WHEN the user has no upcoming events in the next 48 hours, THE App SHALL not display the upcoming-events Summary_Card.

---

### Requirement 4: Summary Cards — Check-In Requests

**User Story:** As a DivaCrew member, I want to see a summary card when someone wants to add me as a trusted check-in contact, so that I can respond promptly.

#### Acceptance Criteria

1. WHEN an authenticated user opens the Home_Screen, THE Home_Service SHALL query `contact_requests` for rows where `recipient_id` equals the user's ID and `status` = `pending`.
2. WHEN at least one pending Checkin_Request exists, THE App SHALL display a Summary_Card showing: the requesting user's nickname, and "Accept" and "Decline" tap targets that invoke the Contact_Service actions defined in the crew-checkin spec.
3. IF multiple pending Checkin_Requests exist, THE App SHALL display the count ("2 people want to check in with you 💛") and a "View all" tap target navigating to the Check-in tab.
4. WHEN no pending Checkin_Requests exist, THE App SHALL not display the check-in-requests Summary_Card.
5. WHEN a user accepts or declines a request directly from the Summary_Card, THE App SHALL update the card state immediately (optimistic update) without requiring a full page reload.

---

### Requirement 5: Summary Cards — Admin Announcements

**User Story:** As a Crew member, I want to see a summary card for important pinned announcements from my crew admins, so that I don't miss something the crew owner flagged as important.

#### Acceptance Criteria

1. WHEN an authenticated user opens the Home_Screen, THE Home_Service SHALL query `crew_posts` for pinned posts (`is_pinned` = `true`) authored by Crew Admins or Owners in any of the user's active Crews, posted within the last 7 days and not soft-deleted.
2. WHEN at least one Admin_Announcement exists, THE App SHALL display a Summary_Card showing: the Crew name, the author's nickname and role label ("Admin" or "Owner"), the first 120 characters of the announcement content, and a tap target navigating to the full post in the Crew's Posts tab.
3. IF multiple Admin_Announcements exist, THE App SHALL display up to 2, ordered by `created_at` descending, with a "See more" tap target if there are additional ones.
4. THE App SHALL display a small label "📢 Crew Update" on the Admin_Announcement Summary_Card to visually distinguish it from regular posts.
5. WHEN no Admin_Announcements within the last 7 days exist, THE App SHALL not display the announcements Summary_Card.

---

### Requirement 6: Recommendation Rail — Candidate Selection and Exclusion

**User Story:** As a DivaCrew member, I want crew and event recommendations that are relevant to me, and I want to know they're based on fair, non-sensitive signals.

#### Acceptance Criteria

1. THE Home_Service SHALL only include Candidate_Crews in the recommendation pool: verified, public Crews with `verification_status` = `verified` (or a public Crew as defined in the crews spec) that the user is NOT an active member of.
2. THE Home_Service SHALL only include Candidate_Events in the recommendation pool: Event_Groups whose `start_time` is in the future, `archived_at` IS NULL, `deleted_at` IS NULL, and the user does NOT have an active membership in.
3. THE Home_Service SHALL exclude from recommendations any Crew or Event_Group that the user has previously dismissed (a dismissal record exists in `home_dismissals` for that user and item).
4. THE Home_Service SHALL exclude from recommendations any Crew or Event_Group whose `organiser_id` or `owner_id` corresponds to a user blocked by the current user (i.e., a record exists in the `blocks` table with `blocker_id` = current user).
5. THE Home_Service SHALL NOT use any of the following attributes in the scoring or filtering of recommendations: `age_bracket`, religion, caste, health status, or any other sensitive personal attribute.
6. THE Home_Service SHALL NOT personalise civic or political content; any "What Changed?" or "Explain This" content tiles SHALL appear identically for all users, ordered by `created_at` descending, if displayed on the Home_Screen.

---

### Requirement 7: Recommendation Scoring Formula

**User Story:** As a product owner, I want a transparent, rule-based scoring formula for recommendations that uses only non-sensitive social signals, so that users receive relevant suggestions without compromising their privacy.

#### Acceptance Criteria

1. THE Scoring_Service SHALL compute a Suggestion_Score for each candidate using an additive formula with three signals, applied independently and summed:
   - **Signal 1 — Shared member overlap**: For each active member of the Candidate_Crew or Candidate_Event who also holds active membership in any Crew the current user is a member of, add +3 points per overlapping member, capped at +15 total for this signal.
   - **Signal 2 — Category match**: If the Candidate_Crew's `category` value matches the `category` of any Crew the user is currently an active member of, add +2 points per matching category, capped at +6 total for this signal.
   - **Signal 3 — City match**: If the Candidate_Crew's city tag matches the `city` field on the user's Profile, add +2 points for this signal.
2. THE Scoring_Service SHALL set `Suggestion_Score = Signal_1 + Signal_2 + Signal_3` where each signal is independently bounded as described in criterion 1.
3. WHEN two or more candidates have identical Suggestion_Scores, THE Scoring_Service SHALL break ties by `member_count` descending (for Crews) or by `start_time` ascending (for Events).
4. THE Scoring_Service SHALL NOT use ML models, embeddings, collaborative filtering, or any form of learned personalisation.
5. THE Scoring_Service SHALL NOT read, store, or transmit the user's `age_bracket`, religion, caste, health, or any sensitive attribute during score computation.
6. THE Home_Service SHALL return a maximum of 10 Recommendation_Items per page, mixing Crews and Events in score order.

---

### Requirement 8: Why Am I Seeing This? Label

**User Story:** As a DivaCrew member, I want every recommendation to tell me why I'm seeing it, so that the app feels transparent and I can trust the suggestions.

#### Acceptance Criteria

1. THE Home_Service SHALL attach a Why_Label to every Recommendation_Item before returning it to the client.
2. THE Why_Label SHALL be computed from the highest-scoring signal(s) for that item, using only the following templates (no personal data beyond crew names and count):
   - Signal 1 dominant: "[N] people from [Crew Name] are here" (e.g., "3 people from Delhi Girlies are here")
   - Signal 2 dominant: "Matches your [Category] crews" (e.g., "Matches your college crews")
   - Signal 3 dominant: "Popular in [City]" (e.g., "Popular in Delhi")
   - Multiple signals tied: combine with " · " separator, e.g., "3 people from Delhi Girlies are here · Matches your college crews"
3. THE App SHALL render the Why_Label on every Recommendation_Item with a visible "✨ Why am I seeing this?" label preceding it, tappable to expand a brief plain-language explanation.
4. THE App SHALL NEVER display a user's `age_bracket`, city name derived from their profile, religion, health, or any sensitive attribute in the Why_Label or its expanded explanation.
5. WHERE the `HOME_AI_REASONS_ENABLED` flag is `false` or not set, THE Home_Service SHALL use the static template-based Why_Label described in criterion 2.
6. WHERE the `HOME_AI_REASONS_ENABLED` flag is `true`, THE AI_Reason_Service SHALL replace the static Why_Label with an AI_Why_Label as defined in Requirement 9.
7. IF the AI_Reason_Service fails or returns an empty string, THE Home_Service SHALL fall back to the static template-based Why_Label without surfacing the error to the user.

---

### Requirement 9: AI Reason Labels (Feature Flag)

**User Story:** As a product owner, I want an optional AI-powered friendly reason label on recommendations, so that the home screen feels more conversational when the feature is enabled.

#### Acceptance Criteria

1. THE AI_Reason_Service SHALL only be invoked when the environment variable `HOME_AI_REASONS_ENABLED` is set to `true`; when absent or `false`, the feature SHALL be completely inactive with no LLM calls made.
2. WHEN invoked, THE AI_Reason_Service SHALL send to the LLM ONLY the following fields for each candidate: crew `name`, crew `category`, crew `tags` array, and the matching signals string (e.g., "3 people from Delhi Girlies are in this Crew").
3. THE AI_Reason_Service SHALL include in the LLM system prompt an explicit instruction: "Do not use or infer any personal data, user demographics, post content, or individual characteristics. Use only the provided crew name, category, tags, and matching signals."
4. THE AI_Reason_Service SHALL instruct the LLM to return a single friendly sentence of at most 20 words in English, matching DivaCrew's warm, Gen-Z tone.
5. THE AI_Reason_Service SHALL validate that the returned AI_Why_Label is a non-empty string of at most 150 characters; responses exceeding this limit or failing validation SHALL trigger the static fallback defined in Requirement 8, criterion 7.
6. THE AI_Reason_Service SHALL NOT send to the LLM: user ID, user city, user `age_bracket`, post content, check-in data, message content, or any other personal or sensitive data.
7. THE AI_Reason_Service SHALL log (without PII) the crew name and whether the AI call succeeded or fell back, for operational monitoring.
8. THE App SHALL render AI_Why_Labels with the same "✨ Why am I seeing this?" affordance as static labels; there SHALL be no UI distinction between AI and static labels visible to the end user.

---

### Requirement 10: Dismissing Recommendations

**User Story:** As a DivaCrew member, I want to dismiss any recommendation I don't want to see, and have that preference respected going forward, so that the screen stays relevant to me.

#### Acceptance Criteria

1. THE App SHALL display a dismiss control (e.g., an "✕" button or a "Not interested" option) on every Recommendation_Item.
2. WHEN a user taps the dismiss control on a Recommendation_Item, THE Dismissal_Service SHALL create a row in `home_dismissals` containing: `user_id`, `item_type` (`crew` or `event`), `item_id`, and `dismissed_at`.
3. THE App SHALL immediately remove the dismissed item from the Recommendation_Rail (optimistic update) without requiring a page reload.
4. AFTER a dismissal is recorded, THE Home_Service SHALL permanently exclude that item from all future Recommendation_Rail responses for that user, even if the user's score for that item would otherwise be high.
5. THE Dismissal_Service SHALL enforce uniqueness: if a dismissal record already exists for a given `user_id` + `item_type` + `item_id` combination, a duplicate SHALL NOT be inserted; the existing dismissal SHALL be treated as still active.
6. THE App SHALL NOT provide a UI to undo a dismissal (dismissals are permanent from the user's perspective); this simplifies the privacy model.
7. THE App SHALL NOT display a count of how many items a user has dismissed or expose dismissal history to the user.

---

### Requirement 11: RLS Policies and Data Access

**User Story:** As a product owner, I want all home screen tables protected by Row Level Security so that users can only read and write their own data.

#### Acceptance Criteria

1. THE App SHALL introduce the following new tables for this feature: `home_screen_state` (tracks `last_seen_at` per user) and `home_dismissals` (tracks dismissed recommendations per user).
2. THE App SHALL enable Row Level Security on `home_screen_state` and `home_dismissals`.
3. WHILE a user is authenticated, THE App SHALL allow that user to read and update only their own row in `home_screen_state` (where `user_id` equals their auth ID).
4. WHILE a user is authenticated, THE App SHALL allow that user to read and insert only their own rows in `home_dismissals` (where `user_id` equals their auth ID).
5. THE App SHALL NOT allow any client to insert or update `home_dismissals` rows with a `user_id` different from the authenticated user's ID; this policy SHALL be enforced at the database layer via RLS.
6. THE App SHALL deny all access to `home_screen_state` and `home_dismissals` for unauthenticated requests.
7. THE Home_Service SHALL access crew, event, and post data only via the existing RLS-protected tables defined in their respective specs; it SHALL NOT bypass RLS for any cross-spec query.
8. THE Home_Service SHALL NOT store a user's city, age bracket, or any other profile attribute in the home-feature tables; it SHALL read these values inline at query time and discard them after computation.

---

### Requirement 12: Privacy and Sensitive Attribute Guardrails

**User Story:** As a product owner, I want hard technical guardrails ensuring that sensitive attributes and civic content are never used in personalisation, so that the feature is safe for all users including minors.

#### Acceptance Criteria

1. THE Scoring_Service SHALL NOT read the `age_bracket` column from the `profiles` table at any point during score computation; a code-level assertion or type constraint SHALL enforce this.
2. THE Scoring_Service SHALL NOT read columns representing religion, caste, health, or political affiliation from any table; these columns SHALL NOT appear in any query constructed by the Scoring_Service.
3. THE Home_Service SHALL serve civic content tiles (if any) without any per-user ordering, filtering, or scoring — the same set and order SHALL be returned for all authenticated users.
4. THE AI_Reason_Service prompt SHALL include a hardcoded system instruction (not configurable via environment variable) that explicitly prohibits using personal data; this instruction SHALL be present in the source code and visible in code review.
5. THE Home_Service SHALL apply block-list filtering (Requirement 6, criterion 4) before returning any Recommendation_Items to the client; no blocked-user content SHALL reach the client payload.
6. WHERE a user's `age_bracket` is `minor`, THE Home_Service SHALL apply the same data-access rules as for adult users with no additional personalisation; the feature MUST NOT behave differently for minors in any way that would require reading `age_bracket`.

---

### Requirement 13: Scoring Function Unit Tests

**User Story:** As a developer, I want comprehensive unit tests for the recommendation scoring function so that the formula is correct, regressions are caught immediately, and privacy invariants are continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: a candidate Crew with 5 shared members, a matching category, and a matching city scores exactly 15 + 2 + 2 = 19 points (Signal 1 capped at 15, Signal 2 = 2, Signal 3 = 2).
2. THE test suite SHALL include a Vitest unit test verifying: a candidate Crew with 6 shared members scores Signal 1 = 15 (cap applied), not 18.
3. THE test suite SHALL include a Vitest unit test verifying: a candidate Crew with 3 matching categories scores Signal 2 = 6 (cap applied), not more.
4. THE test suite SHALL include a Vitest unit test verifying: a candidate with no overlapping members, no matching category, and no city match scores exactly 0.
5. THE test suite SHALL include a Vitest unit test verifying: when two candidates have the same Suggestion_Score, the one with the higher `member_count` is ranked first (tie-breaking rule for Crews).
6. THE test suite SHALL include a Vitest unit test verifying: a dismissed candidate is excluded from the result set even when its Suggestion_Score is the highest among all candidates.
7. THE test suite SHALL include a Vitest unit test verifying: a candidate whose organiser is in the user's blocks list is excluded from the result set regardless of score.
8. THE test suite SHALL include a property-based test: FOR ALL valid candidate sets where Signal 1 produces N overlapping members (N ≥ 0), `computeSignal1(N) = min(N * 3, 15)` — verifying the cap invariant holds for all N.
9. THE test suite SHALL include a property-based test: FOR ALL valid candidate sets, `Suggestion_Score = computeSignal1 + computeSignal2 + computeSignal3` and the result is always a non-negative integer — verifying score additivity and non-negativity for arbitrary inputs.
10. THE test suite SHALL include a Vitest unit test verifying: the Scoring_Service input type does NOT include `age_bracket`, and passing an object with an `age_bracket` field does not affect the output score (structural privacy guard).

---

### Requirement 14: Home Screen State — Last Seen Tracking

**User Story:** As a developer, I want the home screen to track when a user last visited so that new-post counts in summary cards are accurate.

#### Acceptance Criteria

1. THE Home_Service SHALL read `last_seen_at` from `home_screen_state` for the authenticated user before computing the new-posts Summary_Card count.
2. WHEN `home_screen_state` has no row for the authenticated user (first visit), THE Home_Service SHALL treat `last_seen_at` as the user's `created_at` timestamp from the `profiles` table.
3. WHEN the Home_Screen payload is successfully assembled and returned to the client, THE Home_Service SHALL upsert the `home_screen_state` row for that user, setting `last_seen_at` to the current server timestamp.
4. THE Home_Service SHALL perform the `last_seen_at` upsert in a non-blocking manner so that a failure to update the timestamp does not prevent the Home_Screen from rendering.
5. THE `home_screen_state` table SHALL contain: `user_id` (primary key, references `profiles`), `last_seen_at` (timestamptz), `created_at` (timestamptz), and `updated_at` (timestamptz).
