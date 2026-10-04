# Requirements Document

## Introduction

Fit Check is a dedicated feature of DivaCrew that gives users a warm, crew-safe space to share outfit photos and ask for feedback from their girls. It lives in its own **Fits** tab in the bottom navigation bar — separate from the main feed — and is not a post type inside the feed.

A Fit Check post contains 1–4 outfit photos, an optional question (e.g., "Which one for farewell?"), and optional style tags. When multiple photos are posted, the community votes A/B/C/D style. Voting results are hidden until a user votes or the poll closes. Polls auto-close after 24 hours (configurable). Comments are encouraged with a body-positive guideline, and an AI styling suggestion feature (behind a feature flag) can surface occasion, comfort, and styling ideas — never comments on appearance or body.

This spec builds on **foundation-auth** (profiles, verification status, age bracket, block list), **crews** (crew_memberships, roles, RLS on crew content), and the **image processing pipeline from feed-posts** (EXIF stripping, compression, private Supabase Storage buckets, signed URLs). It does NOT duplicate image handling logic; it reuses the `Image_Processor` from the feed-posts spec.

The audience may include minors (16–17). All privacy-first and body-safety rules apply throughout.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Fit_Check_Service**: The server-side component in `/lib/fits` responsible for creating, fetching, soft-deleting, and validating Fit Check posts.
- **Vote_Service**: The server-side component in `/lib/fits` that records votes, enforces one-vote-per-user, handles vote changes, and closes polls.
- **Poll_Closer**: The server-side scheduled job (or Supabase cron) that sets `closed_at` on polls whose `closes_at` timestamp has elapsed.
- **Comment_Service**: The server-side component in `/lib/fits` handling comments on Fit Check posts, including the body-positive guideline prompt and blocked term filtering.
- **AI_Styling_Service**: The server-side component in `/lib/fits/ai` that, when the AI feature flag is enabled, sends a photo to the AI model and returns styling suggestions.
- **Moderation_Service**: The server-side component in `/lib/fits` (or shared from `/lib/security`) that handles reporting of comments and posts and enforces the body-shaming block list.
- **Image_Processor**: The shared image processing pipeline from the feed-posts spec (`/lib/feed`) — reused without modification for EXIF stripping, compression, private bucket storage, and signed URL generation.
- **Fit_Check_Post**: A record in the `fit_check_posts` table representing a user's outfit-photo post with an optional question, optional tags, and associated poll.
- **Poll**: The voting component of a Fit_Check_Post. When a Fit_Check_Post has 2–4 photos, the Poll enables A/B/C/D voting. When the post has 1 photo, the Poll is disabled and only comments apply.
- **Poll_Option**: One of the A/B/C/D choices in a Poll, each corresponding to one uploaded outfit photo.
- **Vote**: A record linking a user to a Poll_Option. One vote per user per Poll; changeable until the poll closes.
- **Fit_Tag**: An optional category label for a Fit_Check_Post — one of: `#college`, `#farewell`, `#fest`, `#casual`, `#ethnic`, `#interview`.
- **Fit_Comment**: A text comment on a Fit_Check_Post, up to 300 characters.
- **AI_Suggestion**: A structured response from the AI_Styling_Service containing exactly 3 short suggestions covering occasion, comfort, and styling — never body, weight, skin, or attractiveness.
- **AI_Ideas_Card**: The UI card that displays AI_Suggestions, clearly labelled "AI ideas ✨", visually separate from votes and comments.
- **Feature_Flag**: A server-side boolean configuration (`AI_STYLING_ENABLED`) that controls whether the "Get style ideas" button is rendered and the AI_Styling_Service is invoked.
- **Blocked_Term_List**: A configurable server-side list of body-shaming terms. Managed in configuration (e.g., an environment-backed table or config file); not hardcoded in application logic.
- **Signed_URL**: A time-limited, authenticated URL from Supabase Storage granting access to a private-bucket image (TTL ≤ 1 hour), as defined in the feed-posts spec.
- **Crew**: A group space as defined in the crews spec.
- **Crew_Member**: A user with an active membership record for a given Crew, as defined in the crews spec.
- **Profile**: A row in the `profiles` table as defined in the foundation-auth spec.
- **Age_Bracket**: `minor` (under 18) or `adult` (18+) as defined in the foundation-auth spec.
- **Verification_Status**: `unverified`, `pending`, or `verified` as defined in the foundation-auth spec.

---

## Requirements

### Requirement 1: Creating a Fit Check Post

**User Story:** As a verified user, I want to post 1–4 outfit photos with an optional question and tags, so that I can ask my crew which look is right for my occasion.

#### Acceptance Criteria

1. WHEN a verified user submits a Fit Check post, THE Fit_Check_Service SHALL create a `fit_check_posts` record containing: `author_id`, `question` (optional, max 150 characters), `tags` (optional array of Fit_Tag values), `visibility` (`crew` or `all_crews`), `created_at`, `closes_at`, and `deleted_at` (null by default).
2. THE Fit_Check_Service SHALL require at least 1 and at most 4 images per post; it SHALL reject submissions with 0 or more than 4 images with a descriptive error.
3. THE Fit_Check_Service SHALL validate that each `tag` value is one of the allowed Fit_Tag values: `#college`, `#farewell`, `#fest`, `#casual`, `#ethnic`, `#interview`; unknown tag values SHALL be rejected.
4. THE Fit_Check_Service SHALL set `closes_at` to `created_at + poll_duration`, where `poll_duration` defaults to 24 hours and is configurable via a server-side configuration value (not a user-supplied field).
5. WHEN a Fit_Check_Post contains 2–4 images, THE Fit_Check_Service SHALL create Poll_Option records labelled A, B, C, D corresponding to each uploaded image in submission order.
6. WHEN a Fit_Check_Post contains exactly 1 image, THE Fit_Check_Service SHALL NOT create Poll_Option records; voting SHALL be disabled for that post.
7. THE Fit_Check_Service SHALL pass all uploaded images through the shared `Image_Processor` (EXIF strip, compress, private bucket storage) before creating the post record; no unprocessed image SHALL be stored.
8. IF a user whose Verification_Status is not `verified` attempts to create a Fit Check post, THEN THE Fit_Check_Service SHALL reject the request with a descriptive error indicating verification is required.
9. WHEN a Fit Check post is created successfully, THE App SHALL navigate the user to the newly created post's detail view.

---

### Requirement 2: Fit Check Visibility — Crew Scoping

**User Story:** As a user posting a Fit Check, I want to choose whether my post is visible to one specific Crew or to all my Crews, so that I can get feedback from the right audience without sharing publicly.

#### Acceptance Criteria

1. WHEN a user creates a Fit Check post, THE App SHALL present a visibility picker with exactly two options: a specific Crew (chosen from the user's active Crew memberships) or "All my Crews".
2. THE Fit_Check_Service SHALL store the visibility as either a `crew_id` (for single-Crew posts) or a sentinel value representing "all_crews" on the `fit_check_posts` record.
3. WHEN a user selects a specific Crew, THE Fit_Check_Service SHALL make the post visible only to active members of that Crew; RLS SHALL enforce this at the database layer.
4. WHEN a user selects "All my Crews", THE Fit_Check_Service SHALL make the post visible to active members of every Crew the author belongs to; RLS SHALL enforce this at the database layer.
5. THE Fit_Check_Service SHALL never make a Fit Check post visible to unauthenticated users or to users who share no Crew with the author.
6. THE App SHALL NOT offer a "Public" or "Anyone" visibility option for Fit Check posts.

---

### Requirement 3: Voting — A/B/C/D Poll

**User Story:** As a Crew_Member viewing a multi-photo Fit Check post, I want to vote for my favourite outfit option, so that I can help the poster pick the best look.

#### Acceptance Criteria

1. WHEN a Crew_Member views a Fit_Check_Post with 2–4 photos and the poll is still open, THE App SHALL display the outfit photos labelled A, B, C, D and a vote button for each option.
2. WHEN a Crew_Member submits a vote, THE Vote_Service SHALL create a Vote record linking `user_id`, `poll_id`, and `poll_option_id`, with `created_at` and `updated_at`.
3. THE Vote_Service SHALL enforce uniqueness: one vote per user per Poll. If a Vote record already exists for that user and poll, THE Vote_Service SHALL update the existing record's `poll_option_id` and `updated_at` rather than creating a duplicate.
4. THE Vote_Service SHALL reject any vote submitted after the poll's `closes_at` timestamp with a descriptive error.
5. WHILE a poll is open, THE App SHALL hide vote counts and percentage results from all users, including the post author, until the viewing user has cast their own vote.
6. WHEN a user casts or changes their vote, THE App SHALL immediately reveal the current vote counts and percentages for all options to that user.
7. WHEN a poll's `closes_at` timestamp is reached, THE Poll_Closer SHALL set the `closed_at` field on the poll record to the current timestamp.
8. WHEN a poll is closed, THE App SHALL display vote counts and percentages to all users who can see the post, regardless of whether they voted.
9. THE App SHALL visually indicate the currently selected option for the viewing user (e.g., a highlight or checkmark) when displaying vote results.
10. THE App SHALL display the poll's remaining time (e.g., "Closes in 4 hrs") while the poll is open.
11. IF a user attempts to change their vote after the poll has closed, THEN THE Vote_Service SHALL reject the request with a descriptive error.

---

### Requirement 4: Comments with Body-Positive Guidance

**User Story:** As a Crew_Member, I want to comment on a Fit Check post with outfit feedback, guided by a kind prompt, so that the space stays supportive and focused on fashion — not bodies.

#### Acceptance Criteria

1. WHEN a user opens the comment input on a Fit Check post, THE App SHALL display a prompt above the input field: "Be kind. Talk about the outfit, not the body. 💛"
2. WHEN a Crew_Member submits a Fit_Comment, THE Comment_Service SHALL create a comment record containing: `post_id`, `author_id`, `content` (1–300 characters), `created_at`, and `deleted_at` (null by default).
3. THE Comment_Service SHALL pass the comment content through the Moderation_Service before persisting; IF the content contains any term from the Blocked_Term_List, THEN THE Comment_Service SHALL reject the submission and return a user-facing message: "That one's not allowed here. Keep it about the fit 💛".
4. THE App SHALL display comments in ascending chronological order below the post.
5. THE App SHALL display a report button on every Fit_Comment visible to the reader.
6. WHEN a Crew_Member deletes their own comment, THE Comment_Service SHALL soft-delete the record by setting `deleted_at` and THE App SHALL replace the comment body with "Comment removed 💨".
7. THE App SHALL display a character count indicator when a user is composing a comment, counting down from 300.
8. IF a user has blocked the author of a comment, THE App SHALL replace the comment body with "Hidden — blocked user" without collapsing the comment slot.

---

### Requirement 5: Poll Auto-Close

**User Story:** As a product owner, I want Fit Check polls to auto-close after a configurable duration (default 24 hours), so that posts don't stay open indefinitely.

#### Acceptance Criteria

1. THE Poll_Closer SHALL run on a scheduled basis (at minimum every 5 minutes) and set `closed_at` on all Poll records where `closes_at` ≤ now and `closed_at` IS NULL.
2. THE Fit_Check_Service SHALL use a server-side configuration value `POLL_DURATION_HOURS` (default 24) to compute `closes_at` at post-creation time; changing this value SHALL affect newly created posts without altering existing ones.
3. WHEN a poll is closed, THE Vote_Service SHALL reject all subsequent vote submissions for that poll with a descriptive error.
4. WHEN a poll is closed, THE App SHALL replace the voting UI with a read-only results view showing vote counts, percentages, and the winning option (most votes); in the event of a tie, THE App SHALL display all tied options equally without declaring a winner.
5. THE App SHALL display "Poll closed" alongside the `closed_at` timestamp formatted as a human-readable date and time (e.g., "Poll closed · 13 July 2025, 4:00 PM").
6. IF `POLL_DURATION_HOURS` is set to a value less than 1 or greater than 168 (7 days), THE Fit_Check_Service SHALL reject the configuration at startup with a descriptive error and SHALL NOT start.

---

### Requirement 6: Anti-Abuse — Body-Shaming Filter, Reporting, and Image Protection

**User Story:** As a user, I want the app to block body-shaming comments, let me report any comment, and protect my outfit photos from being downloaded or reposted outside the app, so that the Fit Check space stays safe and respectful.

#### Acceptance Criteria

1. THE Moderation_Service SHALL maintain a Blocked_Term_List of body-shaming terms stored in a configurable server-side source (e.g., a database table or environment-backed config); the list SHALL NOT be hardcoded in application logic.
2. WHEN a Fit_Comment is submitted, THE Moderation_Service SHALL check the content against the Blocked_Term_List in a case-insensitive manner; IF a match is found, THE Comment_Service SHALL reject the comment as described in Requirement 4, criterion 3.
3. THE App SHALL display a report button on every Fit_Comment and on every Fit_Check_Post visible to the reader.
4. WHEN a user submits a report on a Fit_Comment or Fit_Check_Post, THE Moderation_Service SHALL create a Report record containing: `reporter_id`, `reported_content_id`, `content_type` (`fit_post` or `fit_comment`), `reason`, and `created_at`; THE App SHALL then display: "We got it — thanks for looking out 💛".
5. THE App SHALL disable the browser's default image right-click / long-press download affordance on all Fit Check outfit photos using appropriate HTML and CSS techniques (e.g., `pointer-events`, `user-select: none`, `draggable="false"`).
6. THE App SHALL display a visible notice on each Fit Check post: "Reposting outside DivaCrew is not allowed 🚫".
7. WHEN a Fit_Comment or Fit_Check_Post is reported five or more times by distinct users, THE Moderation_Service SHALL flag the content for admin review by setting a `flagged_for_review` field to `true`.
8. THE App SHALL NOT display the report option on the user's own posts or comments.

---

### Requirement 7: Image Handling — Reuse of Shared Pipeline

**User Story:** As a developer, I want Fit Check image uploads to go through the same image processing pipeline as feed posts, so that EXIF stripping, compression, and private storage are consistently applied without duplicating code.

#### Acceptance Criteria

1. THE Fit_Check_Service SHALL call the shared `Image_Processor` component (defined in the feed-posts spec, located in `/lib/feed`) for all image uploads; it SHALL NOT implement its own EXIF stripping, compression, or storage logic.
2. THE Image_Processor SHALL strip all EXIF metadata — including GPS coordinates, device model, and timestamp — from every uploaded Fit Check image before storage.
3. THE Image_Processor SHALL store all Fit Check images in a private Supabase Storage bucket that does not allow public reads.
4. WHEN a client requests to display a Fit Check image, THE App SHALL obtain a Signed_URL with a TTL of at most 1 hour from Supabase Storage and render the image using that URL.
5. THE Image_Processor SHALL reject Fit Check image uploads larger than 5 MB and SHALL return a descriptive error to the user.
6. THE Image_Processor SHALL accept JPEG, PNG, and WebP formats only for Fit Check images.
7. IF any image in a Fit Check post submission fails processing, THEN THE Fit_Check_Service SHALL reject the entire post submission and SHALL NOT create any partial records.
8. THE App SHALL display meaningful alt text on all Fit Check outfit images; where no question or description is provided, THE App SHALL use a fallback such as "Outfit photo shared by [nickname]".

---

### Requirement 8: AI Styling Suggestions (Feature Flag)

**User Story:** As a user, I want the option to get short AI-generated styling ideas for my outfit, so that I can explore occasion, comfort, and styling angles — without any comments on my appearance.

#### Acceptance Criteria

1. THE App SHALL render a "Get style ideas ✨" button on a Fit Check post detail view ONLY WHEN the `AI_STYLING_ENABLED` Feature_Flag is `true`; WHEN the flag is `false`, the button SHALL NOT be rendered and no AI call SHALL be made.
2. WHEN a user taps "Get style ideas ✨", THE AI_Styling_Service SHALL send the outfit photo to the configured AI model along with a system prompt that explicitly forbids any output relating to body shape, weight, skin, attractiveness, or physical appearance.
3. THE AI_Styling_Service SHALL instruct the AI model to return exactly 3 short suggestions (each ≤ 60 words) covering only these three dimensions: (1) occasion fit, (2) comfort and practicality, (3) styling or accessory ideas.
4. THE AI_Styling_Service SHALL NOT store or log the image on the AI provider side beyond the duration of the single inference request; the system prompt SHALL include an explicit instruction not to retain the image.
5. THE App SHALL display AI suggestions in a dedicated AI_Ideas_Card labelled "AI ideas ✨"; this card SHALL be visually separate from the poll votes, vote counts, and comments sections.
6. THE App SHALL never mix AI_Suggestion content with votes, vote counts, or user comments in the same visual region.
7. IF the AI model returns output containing any of the prohibited topics (body shape, weight, skin, attractiveness, physical appearance), THEN THE AI_Styling_Service SHALL discard the response entirely and return a generic fallback message: "Couldn't get ideas right now — try again 💛".
8. THE AI_Styling_Service SHALL validate AI model responses against a blocklist of prohibited terms before displaying them; prohibited terms SHALL be defined in the same configurable source as the Blocked_Term_List.
9. WHEN the AI_Styling_Service request fails for any reason (timeout, model error, network error), THE App SHALL display: "Couldn't get ideas right now — try again 💛" and SHALL NOT show a blank or partially rendered AI_Ideas_Card.
10. THE AI_Ideas_Card SHALL display a visible disclosure: "AI-generated ideas — not a style verdict 🤖✨".

---

### Requirement 9: Fit Check Tab and Feed

**User Story:** As a user, I want a dedicated Fits tab that shows me Fit Check posts from all my Crews, newest first, so that I can browse and interact with outfit posts in one place.

#### Acceptance Criteria

1. THE App SHALL render the Fits tab in the Bottom_Nav as the third tab, between Crews and Check-in, consistent with the app shell defined in foundation-auth.
2. WHEN an authenticated user opens the Fits tab, THE Fit_Check_Service SHALL return a paginated list of Fit_Check_Posts visible to the user (based on Crew membership and post visibility), ordered by `created_at` descending.
3. THE Fit_Check_Service SHALL use cursor-based pagination; each response SHALL include a `next_cursor` value, and the client SHALL pass this cursor to retrieve the next page, with a maximum of 20 posts per page.
4. IF a Fit_Check_Post has been soft-deleted (`deleted_at` is not null), THEN THE Fit_Check_Service SHALL exclude it from all feed responses.
5. IF a user has blocked the author of a Fit_Check_Post, THEN THE Fit_Check_Service SHALL exclude all posts by that author from the user's Fits tab.
6. WHEN the Fits tab has no posts to display, THE App SHALL display an Empty_State with copy such as "No fits yet — post yours and ask your crew 👗".
7. WHEN the Fits tab is loading, THE App SHALL display Skeleton placeholders that match the shape of Fit Check post cards.
8. THE Fit_Check_Service SHALL enforce RLS: a user SHALL NOT receive posts from a Crew they are not an active member of, even if a cursor from a previous session is replayed.

---

### Requirement 10: Post Deletion and Lifecycle

**User Story:** As a post author, I want to delete my own Fit Check posts, and as a Crew admin, I want to remove posts that violate community rules, so that harmful content can be taken down promptly.

#### Acceptance Criteria

1. THE App SHALL display a "Delete post" option in the context menu of any Fit_Check_Post where the authenticated user is the author.
2. WHEN a user taps "Delete post", THE App SHALL display a confirmation prompt (e.g., "Delete this fit check?") before proceeding.
3. WHEN confirmed, THE Fit_Check_Service SHALL soft-delete the record by setting `deleted_at` to the current timestamp; the row SHALL NOT be physically removed.
4. WHEN a post is soft-deleted, THE App SHALL remove it from the Fits tab feed immediately, without a page reload.
5. THE Fit_Check_Service SHALL allow an Admin or Owner of the Crew associated with the post to soft-delete a Fit_Check_Post; the `deleted_by` field SHALL record the moderating user's ID.
6. THE Fit_Check_Service SHALL enforce ownership: only the post author, or a Crew Admin/Owner of the post's target Crew(s), may soft-delete a post; all other deletion attempts SHALL be rejected with an authorisation error.

---

### Requirement 11: RLS Policies for Fit Check

**User Story:** As a product owner, I want Row Level Security policies on all Fit Check tables ensuring users can only see posts and votes from Crews they belong to, so that outfit photos are never exposed beyond the intended audience.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on all tables introduced by this spec: `fit_check_posts`, `fit_check_poll_options`, `fit_check_votes`, `fit_check_comments`, `fit_check_reports`.
2. WHILE a user is authenticated, THE Fit_Check_Service SHALL only return `fit_check_posts` rows where the user is an active member of the post's target Crew(s) — this policy SHALL be enforced at the database layer via RLS, not only in application code.
3. THE App SHALL not allow a user to vote, comment, or report on a Fit_Check_Post from a Crew they are not an active member of; all such operations SHALL be blocked by RLS policies on the respective tables.
4. THE App SHALL allow a user to read and delete only their own rows in the `fit_check_votes` table.
5. THE App SHALL not allow any client to insert directly into `fit_check_reports`; all report inserts SHALL be performed via a trusted server-side function.
6. THE App SHALL deny all access to all Fit Check tables for unauthenticated requests.
7. WHEN a user's Crew membership is revoked or set to a non-active status, THE Fit_Check_Service SHALL immediately exclude all Fit Check posts from that Crew from subsequent requests.

---

### Requirement 12: Voting Rules and Poll Closing Tests

**User Story:** As a developer, I want automated tests for voting rules and poll auto-close behaviour, so that vote uniqueness, change logic, and closing are continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when a user votes on a poll, a Vote record is created linking the correct `user_id` and `poll_option_id`.
2. THE test suite SHALL include a Vitest unit test verifying: when a user attempts to vote a second time on the same poll, no duplicate Vote record is created; instead, the existing record's `poll_option_id` is updated.
3. THE test suite SHALL include a Vitest unit test verifying: when a vote is submitted after the poll's `closes_at` timestamp, the Vote_Service returns an error and no Vote record is created or modified.
4. THE test suite SHALL include a Vitest unit test verifying: vote counts and percentages are hidden from a user who has not yet voted on an open poll.
5. THE test suite SHALL include a Vitest unit test verifying: vote counts and percentages are visible to a user immediately after they cast their vote.
6. THE test suite SHALL include a Vitest unit test verifying: when the Poll_Closer runs for a poll whose `closes_at` ≤ now, the poll's `closed_at` field is set and all subsequent vote submissions return an error.
7. THE test suite SHALL include a round-trip property: FOR ALL sequences of votes cast by distinct users on the same poll before `closes_at`, the sum of all Poll_Option vote counts SHALL equal the total number of distinct voters on that poll. (Property: votes are recorded without loss or duplication across any number of voters)
8. THE test suite SHALL include a Vitest unit test verifying: when a poll closes (via Poll_Closer), vote results become visible to all users who can see the post, including users who did not vote.
9. THE test suite SHALL include a Playwright end-to-end test simulating: a user creates a Fit Check post with 3 photos, a second user votes, both users can see vote counts after voting, the poll auto-closes, and a third user who did not vote can see the final results.
10. THE test suite SHALL include a Vitest unit test verifying: a Fit Check post with 1 photo has no Poll_Option records created, and the voting UI is not rendered for that post.

---

### Requirement 13: Body-Positive Comment Filter Tests

**User Story:** As a developer, I want automated tests for the body-shaming comment filter, so that the Blocked_Term_List enforcement is verified and regressions are caught immediately.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: a comment containing a term from the Blocked_Term_List is rejected with the correct user-facing error message.
2. THE test suite SHALL include a Vitest unit test verifying: a comment containing no blocked terms is accepted and persisted.
3. THE test suite SHALL include a Vitest unit test verifying: the term matching is case-insensitive (e.g., a term in upper, lower, or mixed case is matched equally).
4. THE test suite SHALL include a round-trip property: FOR ALL comment strings that do not contain any term from the Blocked_Term_List, the Comment_Service SHALL accept and persist the comment; FOR ALL comment strings that contain at least one term from the Blocked_Term_List, the Comment_Service SHALL reject the comment. (Property: the filter is total — every string is correctly classified)
5. THE test suite SHALL include a Vitest unit test verifying: when the Blocked_Term_List is updated (a term added or removed), subsequent comment submissions reflect the updated list without requiring a server restart.
