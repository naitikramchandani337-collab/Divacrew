# Requirements Document

## Introduction

The Feed ("The Crew") and Posts feature is the social heart of DivaCrew. It surfaces a home feed showing posts aggregated from all the Crews a user belongs to, and it defines the complete post interaction system: six post types, reactions, comments with one level of replies, reposts, saves, image handling, moderation actions, and a dedicated Safety Update post type that displays community reports responsibly.

This spec builds on **foundation-auth** (authenticated profiles, verification status, age brackets, block list) and **crews** (crew_memberships, crew_posts table, crew roles). It does not duplicate those tables; instead it extends crew_posts and adds new tables (reactions, comments, saves, hides, reposts) to support the full interaction model. The home feed is distinct from the in-Crew Posts tab: it aggregates content across all the user's crews into a single, paginated stream.

The audience may include minors (16–17). All safety rules — stripping EXIF data, hiding blocked authors, applying minor privacy defaults, never claiming safety — apply throughout.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Feed_Service**: The server-side component in `/lib/feed` that queries and paginates the home feed.
- **Post_Service**: The server-side component in `/lib/feed` responsible for creating, fetching, soft-deleting, and validating all post types.
- **Reaction_Service**: The server-side component handling "Girl, same 💅" reactions and their counts.
- **Comment_Service**: The server-side component handling comments and replies on posts.
- **Repost_Service**: The server-side component handling reposts within a user's crews.
- **Save_Service**: The server-side component handling saved posts per user.
- **Moderation_Service**: The server-side component handling reports, hides, and block-author actions on posts and comments.
- **Image_Processor**: The server-side component in `/lib/feed` that compresses uploaded images, strips EXIF/location metadata, and stores them in Supabase Storage private buckets.
- **Home_Feed**: The paginated stream of Crew_Posts from all Crews the authenticated user is a member of, shown on the Feed tab, ordered newest-first.
- **Crew_Post**: A piece of user-generated content in a Crew's Posts tab, as defined in the crews spec. This spec extends Crew_Post with additional fields for post type, reactions, and feed metadata.
- **Post_Type**: The classification of a Crew_Post — one of: `text`, `image`, `question`, `recommendation`, `event_update`, `safety_update`.
- **Safety_Update**: A Crew_Post with `post_type` = `safety_update`. Represents a community-submitted report. It is never presented as verified.
- **Reaction**: A "Girl, same 💅" acknowledgement a user attaches to a Crew_Post. Replaces a generic "Like". One reaction per user per post.
- **Comment**: A text response to a Crew_Post, up to 500 characters.
- **Reply**: A text response to a Comment (one level deep only), up to 500 characters.
- **Repost**: A resharing of a Crew_Post into one of the reposter's own Crews.
- **Save**: A private bookmark a user places on a Crew_Post for their own reference. Not visible to others.
- **Hide**: A per-user action that removes a specific post from the user's Home_Feed without reporting it.
- **Block_Author**: A per-user action that hides all content from a specific author, as defined in foundation-auth but applied in the feed and post context.
- **Report**: A flag submitted against a Crew_Post or Comment indicating harmful or violating content.
- **Skeleton**: A loading placeholder that mirrors the shape of a post card or comment, shown while data is fetching.
- **Empty_State**: A screen or section shown when no posts or comments are available.
- **Cursor**: An opaque pagination token encoding the position in the feed (typically a `created_at` + `id` composite) used for cursor-based pagination.
- **Signed_URL**: A time-limited, authenticated URL issued by Supabase Storage granting access to a private-bucket image.
- **EXIF**: Embedded metadata in image files that may contain GPS coordinates, device details, or other private information.
- **Profile**: A row in the `profiles` table as defined in foundation-auth.
- **Verification_Status**: The `verification_status` field on a Profile (`unverified`, `pending`, `verified`) as defined in foundation-auth.
- **Age_Bracket**: `minor` (under 18) or `adult` (18+) as defined in foundation-auth.
- **Crew_Member**: A user with an accepted membership record for a given Crew, as defined in the crews spec.

---

## Requirements

### Requirement 1: Home Feed — Aggregation and Pagination

**User Story:** As a verified user, I want a home feed that shows posts from all my crews, newest first, so that I can catch up with everything in one place without visiting each Crew individually.

#### Acceptance Criteria

1. WHEN an authenticated user opens the Feed tab, THE Feed_Service SHALL return a paginated list of Crew_Posts from all Crews the user is an active member of, ordered by `created_at` descending.
2. THE Feed_Service SHALL use cursor-based pagination: each response SHALL include a `next_cursor` value, and the client SHALL pass this cursor as a query parameter to retrieve the next page.
3. THE Feed_Service SHALL return a maximum of 20 posts per page.
4. WHEN the user reaches the end of the feed, THE App SHALL display an Empty_State indicating there are no more posts, using warm DivaCrew copy ("You're all caught up, girl 💅").
5. IF a Crew_Post has been soft-deleted (`deleted_at` is not null), THEN THE Feed_Service SHALL exclude it from all feed responses.
6. IF a user has hidden a Crew_Post (a Hide record exists for that user and post), THEN THE Feed_Service SHALL exclude that post from the user's feed responses.
7. IF a user has blocked the author of a Crew_Post, THEN THE Feed_Service SHALL exclude all posts by that author from the user's feed responses.
8. THE Feed_Service SHALL exclude posts from Crews the user is no longer an active member of (membership `status` is not `active`).
9. WHEN the feed is loading, THE App SHALL display Skeleton placeholders that match the shape of post cards.
10. THE Feed_Service SHALL enforce RLS: a user SHALL NOT receive posts from a Crew they are not an active member of, even if a cursor from a previous session is replayed.

---

### Requirement 2: Post Types

**User Story:** As a Crew_Member, I want to choose the type of post I'm creating — text, image, question, recommendation, event update, or safety update — so that my crewmates immediately understand what I'm sharing.

#### Acceptance Criteria

1. WHEN a Crew_Member creates a post, THE Post_Service SHALL accept a `post_type` field with exactly one of these values: `text`, `image`, `question`, `recommendation`, `event_update`, `safety_update`.
2. THE Post_Service SHALL validate that a post with `post_type` = `image` contains at least one image URL in `image_urls` and at most four image URLs.
3. THE Post_Service SHALL validate that all post types include a non-empty `content` field of at most 1 000 characters.
4. WHEN a post with `post_type` = `safety_update` is displayed, THE App SHALL prominently show the post's `created_at` timestamp formatted as a human-readable date and time.
5. WHEN a post with `post_type` = `safety_update` is displayed, THE App SHALL render a clearly visible label stating: "Community report — not verified".
6. THE App SHALL never display language suggesting a safety update is confirmed, verified by DivaCrew, or that any person or place is safe.
7. THE App SHALL render a visually distinct chip or label on each post card indicating its `post_type` (e.g., "Question ❓", "Rec 💅", "Event 📅", "⚠️ Safety Update"), so users can scan post types at a glance.
8. WHERE a post has `post_type` = `question`, THE App SHALL render the post body styled to visually distinguish it as a question (e.g., highlighted border or question mark icon).
9. THE Post_Service SHALL store `post_type` as a non-nullable column on the `crew_posts` table (or an extension table) and SHALL reject any post creation request with an unrecognised `post_type` value.

---

### Requirement 3: Image Uploads

**User Story:** As a Crew_Member, I want to upload images in my posts knowing they are stored privately and my location is not exposed, so that I can share visuals safely.

#### Acceptance Criteria

1. THE Image_Processor SHALL accept image uploads in JPEG, PNG, and WebP formats only.
2. THE Image_Processor SHALL reject any image file larger than 5 MB before processing, returning a descriptive error.
3. THE Image_Processor SHALL compress each accepted image to reduce file size before storage, targeting a quality level that preserves visual clarity at reduced byte size.
4. THE Image_Processor SHALL strip all EXIF metadata — including GPS coordinates, device model, and timestamp — from every image before storage.
5. THE Image_Processor SHALL store all post images in a private Supabase Storage bucket that does not allow public reads.
6. WHEN a client requests to display a post image, THE App SHALL obtain a Signed_URL with a limited TTL (no longer than 1 hour) from Supabase Storage and render the image using that URL.
7. IF an image upload fails at any stage (size check, EXIF stripping, compression, or storage), THEN THE Post_Service SHALL return a descriptive error and SHALL NOT create the post record.
8. THE Image_Processor SHALL process each image server-side before any storage write; no unprocessed image SHALL be written to the storage bucket.
9. THE App SHALL display meaningful alt text on all post images; where the author has not provided a description, THE App SHALL use a fallback such as "Image shared by [nickname]".

---

### Requirement 4: Reactions — "Girl, same 💅"

**User Story:** As a Crew_Member reading a post, I want to react with "Girl, same 💅" instead of a generic Like, so that the interaction feels warm and true to DivaCrew's tone.

#### Acceptance Criteria

1. THE App SHALL display a single reaction type on every Crew_Post: "Girl, same 💅". There SHALL be no generic "Like" button anywhere in the post interaction surface.
2. WHEN a Crew_Member taps "Girl, same 💅" on a post, THE Reaction_Service SHALL create a reaction record linking the user to the post.
3. THE Reaction_Service SHALL enforce uniqueness: one reaction per user per Crew_Post. If a reaction record already exists for that user and post, the Reaction_Service SHALL toggle it off (delete the record) rather than creating a duplicate.
4. WHEN a user removes their reaction, THE Reaction_Service SHALL delete the reaction record and THE App SHALL update the displayed count immediately.
5. THE App SHALL display the total reaction count on each post card and update it optimistically on tap.
6. IF a user is not an active Crew_Member of the Crew containing the post, THEN THE Reaction_Service SHALL reject the reaction with an authorisation error.

---

### Requirement 5: Comments and Replies

**User Story:** As a Crew_Member, I want to comment on posts and reply to comments, so that I can have conversations with my crew in context.

#### Acceptance Criteria

1. WHEN a Crew_Member submits a comment on a Crew_Post, THE Comment_Service SHALL create a comment record containing: `post_id`, `author_id`, `content` (1–500 characters), `created_at`, and `deleted_at` (null by default).
2. WHEN a Crew_Member submits a reply to a comment, THE Comment_Service SHALL create a reply record linked to the parent comment via `parent_comment_id`. Replies SHALL be limited to one level of nesting — a reply cannot itself receive replies.
3. THE App SHALL display comments in ascending chronological order below the post, with replies displayed indented under their parent comment.
4. THE App SHALL display a maximum of 30 comments per post by default, with a "Load more" affordance to fetch additional comments.
5. WHEN a Crew_Member deletes their own comment or reply, THE Comment_Service SHALL soft-delete the record by setting `deleted_at` and THE App SHALL replace the comment body with "Comment removed 💨" rather than collapsing the thread.
6. THE App SHALL display a report button, a hide option, and a block-author option on every comment and reply visible to the reader.
7. IF a user has blocked the author of a comment or reply, THE App SHALL replace the comment body with "Hidden — blocked user" and collapse any replies from the same author.
8. IF a Crew_Member is muted (as defined in the crews spec), THEN THE Comment_Service SHALL reject new comments and replies from that member with a descriptive error.
9. THE App SHALL display a character count indicator when a user is composing a comment or reply, counting down from 500.

---

### Requirement 6: Reposts

**User Story:** As a Crew_Member, I want to repost a piece of content into one of my own crews, so that I can share something I found in one crew with a different group.

#### Acceptance Criteria

1. WHEN a Crew_Member taps "Repost", THE App SHALL present a crew-picker showing only the Crews in which the user is an active member and into which they have permission to post (role `member`, `admin`, or `owner`).
2. WHEN a Crew_Member confirms a repost, THE Repost_Service SHALL create a new Crew_Post record in the target Crew with `post_type` = `text`, a reference field `repost_of` pointing to the original post's ID, and an attribution line showing the original author's nickname.
3. THE App SHALL render reposts with a visible "Reposted from [Crew name]" label and display the original post's content and author attribution.
4. THE Repost_Service SHALL not allow a user to repost into a Crew they are not an active member of; such attempts SHALL be rejected with an authorisation error.
5. THE Repost_Service SHALL not allow reposting of a post that has been soft-deleted; such attempts SHALL be rejected with a descriptive error.
6. THE App SHALL display the repost count on each post card.

---

### Requirement 7: Save

**User Story:** As a Crew_Member, I want to privately save a post for later, so that I can revisit content I found useful without anyone else seeing my saves.

#### Acceptance Criteria

1. WHEN a Crew_Member taps the save icon on a post, THE Save_Service SHALL create a save record linking the user's ID to the post's ID.
2. THE Save_Service SHALL enforce uniqueness: one save per user per post. If the record already exists, THE Save_Service SHALL remove it (toggle off), effectively unsaving the post.
3. THE App SHALL update the save icon state immediately upon tap (optimistic update).
4. Save records SHALL be private: no other user, including the post's author, SHALL be able to query or infer who has saved a post.
5. THE App SHALL provide a "Saved Posts" section accessible from the Me tab where the user can view all their saved posts in reverse-chronological order.
6. IF a saved post is subsequently soft-deleted, THE App SHALL not display the deleted post in the Saved Posts section; the save record may remain but SHALL be filtered on read.

---

### Requirement 8: Post and Comment Moderation — Report, Hide, Block Author

**User Story:** As a Crew_Member, I want to report, hide, or block the author of any post or comment I see, so that I can protect myself from harmful or unwanted content without needing a moderator to act first.

#### Acceptance Criteria

1. THE App SHALL display a context menu (accessible via a "⋮" or long-press) on every Crew_Post and every comment visible to the reader, offering three options: "Report", "Hide this post", and "Block [nickname]".
2. WHEN a user selects "Report" on a Crew_Post or comment, THE Moderation_Service SHALL present a reason-selection screen and, on confirmation, create a Report record containing: `reporter_id`, `reported_content_id`, `content_type` (`post` or `comment`), `reason`, and `created_at`.
3. WHEN a Report is submitted, THE App SHALL display a confirmation message in DivaCrew tone: "We got it — thanks for looking out 💛".
4. WHEN a user selects "Hide this post", THE Moderation_Service SHALL create a Hide record for that user and post, and THE App SHALL immediately remove the post from the user's feed without a page reload.
5. WHEN a user selects "Block [nickname]", THE Moderation_Service SHALL invoke the block action as defined in the foundation-auth Settings spec, immediately hiding all content from that author across the entire app.
6. THE App SHALL NOT display the "Block [nickname]" or "Report" options on the user's own posts or comments.
7. WHEN a Crew_Post or comment is reported five or more times by distinct users, THE Moderation_Service SHALL flag the content for admin review by setting a `flagged_for_review` field to `true`.
8. THE App SHALL display a report button on every Crew_Post even when the post's author is not in the same Crew as the reporter, as long as the reporter can see the post.

---

### Requirement 9: Post Deletion by Authors

**User Story:** As a post author, I want to delete my own posts, so that I can remove content I no longer want to share.

#### Acceptance Criteria

1. THE App SHALL display a "Delete post" option in the context menu of any Crew_Post or comment where the authenticated user is the author.
2. WHEN a user taps "Delete post", THE App SHALL display a brief confirmation (e.g., "Delete this post?") before proceeding.
3. WHEN a user confirms deletion, THE Post_Service SHALL soft-delete the record by setting `deleted_at` to the current timestamp; the row SHALL NOT be physically removed.
4. WHEN a post is soft-deleted, THE App SHALL remove it from all feed views, in-Crew post lists, and repost previews immediately, without requiring a page reload.
5. WHEN a post is soft-deleted, all associated Skeleton and loading states SHALL no longer display it.
6. THE Post_Service SHALL enforce ownership: only the post author or a Crew Admin/Owner (as defined in the crews spec) may soft-delete a Crew_Post. Any other user's deletion request SHALL be rejected with an authorisation error.

---

### Requirement 10: Safety Update Post Type — Display Rules

**User Story:** As a reader, I want safety update posts to be visually distinct and clearly labelled as unverified community reports, so that I am never misled into treating a post as an official safety verdict.

#### Acceptance Criteria

1. THE App SHALL render Safety_Update posts with a visually distinct card style (e.g., an amber or warning-coloured border or header band) that differentiates them from all other post types in the feed.
2. THE App SHALL display the `created_at` timestamp of a Safety_Update post in a prominent position (above the post body), formatted to show the full date and time (e.g., "12 July 2025, 3:45 PM").
3. THE App SHALL render a non-removable label on every Safety_Update post card: "Community report — not verified by DivaCrew".
4. THE App SHALL never render language on a Safety_Update post that suggests the report is confirmed, that a person or location is safe, or that DivaCrew endorses the content.
5. THE App SHALL include a small informational note beneath Safety_Update posts: "Community reports help your crew stay aware. Always use your own judgement and contact emergency services (112) if needed."
6. THE Post_Service SHALL reject any Safety_Update post whose `content` field is empty; a descriptive error SHALL be returned.
7. THE App SHALL display Safety_Update posts in the Home_Feed with the same visibility, pagination, and RLS rules as all other post types.

---

### Requirement 11: Empty States and Loading Skeletons

**User Story:** As a user, I want friendly empty states and loading skeletons that match DivaCrew's tone, so that the app feels alive and welcoming even when there is no content yet.

#### Acceptance Criteria

1. WHEN the Home_Feed has no posts to display (the user is in no Crews, or all Crews have no posts), THE App SHALL display an Empty_State screen with warm DivaCrew copy and a call-to-action to discover or join Crews.
2. WHEN the Saved Posts section has no saves, THE App SHALL display an Empty_State with copy such as "Nothing saved yet — tap 🔖 on any post to keep it handy".
3. WHEN a post's comments section has no comments, THE App SHALL display an Empty_State with copy such as "No comments yet — be the first to say something 💬".
4. WHEN any feed or list is loading, THE App SHALL display Skeleton placeholders that match the dimensions and layout of the content that will appear, using DivaCrew's brand colours.
5. THE Skeleton placeholders SHALL animate (e.g., a shimmer effect) to indicate activity.
6. THE App SHALL replace Skeleton placeholders with real content or an Empty_State as soon as data is available, without layout shift that would disrupt reading.
7. THE App SHALL display a Skeleton for each expected post slot (minimum 3, maximum 5) during initial feed load, regardless of how many posts will actually be returned.

---

### Requirement 12: RLS Policies for Feed Visibility

**User Story:** As a product owner, I want Row Level Security policies on all feed-related tables ensuring users can only see posts from Crews they belong to, so that private Crew content is always protected.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on all new tables introduced by this spec: `reactions`, `comments`, `reposts`, `saves`, `hides`, `reports` (feed context), and any extension columns or tables added to `crew_posts`.
2. WHILE a user is authenticated, THE Feed_Service SHALL only return rows from `crew_posts` where the user has an active membership record (`status` = `active`) in the corresponding Crew — this policy SHALL be enforced at the database layer via RLS, not only in application code.
3. THE App SHALL not allow a user to react, comment, repost, or save a post from a Crew they are not an active member of; all such operations SHALL be blocked by RLS policies on the respective tables.
4. THE App SHALL allow a user to read and delete only their own rows in the `saves` and `hides` tables.
5. THE App SHALL allow a user to read and delete only their own rows in the `reactions` table and to read reaction counts on posts they can already see.
6. THE App SHALL not allow any client to insert directly into `reports`; all report inserts SHALL be performed via a trusted server-side function.
7. THE App SHALL deny all access to `reactions`, `comments`, `reposts`, `saves`, `hides`, and `reports` for unauthenticated requests.
8. WHEN a user's Crew membership is revoked or set to a non-active status, THE Feed_Service SHALL immediately exclude all posts from that Crew from subsequent feed requests, without requiring a cache flush.

---

### Requirement 13: Feed Visibility RLS Tests

**User Story:** As a developer, I want automated tests that continuously verify the RLS feed-visibility policies, so that membership-based access control is never accidentally broken.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when a `crew_posts` query is executed with the JWT of a user who is not an active member of the Crew, the result set is empty.
2. THE test suite SHALL include a Vitest unit test verifying: when the same query is executed with the JWT of an active Crew_Member, the expected posts are returned.
3. THE test suite SHALL include a Vitest unit test verifying: when a user's membership status is changed from `active` to `left` or `removed`, subsequent feed queries for that user return no posts from that Crew.
4. THE test suite SHALL include a round-trip property: FOR ALL Crew_Posts created in a private Crew by user A, user B who has never been an active member of that Crew SHALL receive an empty result set when querying the feed with user B's JWT, regardless of the post content. (Round-trip: create private Crew → add posts as user A → query feed as non-member user B → assert empty result)
5. THE test suite SHALL include a Vitest unit test verifying: a Hide record created by user A for a post causes that post to be excluded from user A's feed response, but the same post remains visible to user B who has not hidden it.
6. THE test suite SHALL include a Vitest unit test verifying: a Block placed by user A on user B causes all of user B's posts to be excluded from user A's feed, but user B's posts remain visible to user C who has not blocked user B.
7. THE test suite SHALL include a Playwright end-to-end test simulating: a user joins a Crew, sees posts in their feed, leaves the Crew, and confirms those posts no longer appear in the feed.
8. THE test suite SHALL include a Vitest unit test verifying: a Safety_Update post is returned in the feed with the correct `post_type`, `created_at` timestamp, and an absence of any "verified" or "safe" language in the rendered output.

