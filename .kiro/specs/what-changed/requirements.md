# Requirements Document

## Introduction

**What Changed?** and **Explain This** are DivaCrew's civic information features. They give girls and young women in India a clear, neutral window into legislation, government announcements, and policy changes that affect their lives — without ever telling them what to think or which side to take.

**What Changed?** is a curated daily card feed of up to three civic items. Every item is written by a human editor, reviewed by a second editor before it is published, and linked to a primary government or parliamentary source. There is no auto-publish: everything goes through an editorial gate.

**Explain This** lets a user tap "Explain it like I'm 17" on any item and receive a structured plain-language breakdown from an LLM. The LLM is strictly constrained: it uses only the primary source text, never states opinions or political positions, and marks anything the source does not answer as "I'm not sure."

Both features show identical content to every user — there is no personalisation of civic or political content. Discussion threads on each item require a required label (FACT, OPINION, SOURCE, QUESTION) and reuse the existing report system for moderation. A disclaimer — "Educational summary, not legal advice." — appears on every item card, every explanation, and every discussion thread.

> ⚠️ **Build order note:** This spec should only be started after the core community features are working and a sourcing plan for civic content is in place. It is marked as **"later"** in the build order.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Civic_Feed**: The "What Changed?" screen displaying the daily curated list of Civic_Items.
- **Civic_Item**: A single published record in the civic feed, containing a type, 2-line summary, category, primary source link, and all associated metadata.
- **Item_Type**: An enumerated classification for a Civic_Item — one of: `bill_introduced`, `bill_passed`, `government_announcement`.
- **Category**: A thematic tag for a Civic_Item — one of: `women_and_safety`, `education`, `jobs`, `technology`, `environment`, `healthcare`, `laws_and_rights`.
- **Editor**: An authenticated user with role `editor` or `admin` who can create and submit draft Civic_Items.
- **Reviewer**: An authenticated user with role `admin`, or a second `editor` who did not author the draft, who can approve or reject a draft Civic_Item (4-eyes principle).
- **Editorial_Service**: The server-side component in `/lib/civic` responsible for creating, updating, reviewing, and publishing Civic_Items.
- **Explain_Service**: The server-side component in `/lib/civic` responsible for sending the LLM prompt and returning a structured Explanation.
- **Explanation**: The structured LLM output for a Civic_Item, containing exactly five sections: What happened, Why it matters, Who it applies to, What's still undecided, Original source link.
- **LLM**: The large language model invoked by the Explain_Service. It receives only the primary source text and the item's type and category — no user data and no other items.
- **LLM_System_Prompt**: The fixed instruction prepended to every LLM invocation: "You are a neutral educational summarizer. Use only the provided source text. Do not state opinions, recommend political positions, or make value judgments. When the source text does not answer a question, respond with 'I'm not sure.' Clearly distinguish confirmed facts from commentary."
- **Civic_Discussion**: The threaded comment section attached to a Civic_Item.
- **Civic_Comment**: A single comment in a Civic_Discussion. Every Civic_Comment must carry a Discussion_Label.
- **Discussion_Label**: A required classification for every Civic_Comment — one of: `FACT`, `OPINION`, `SOURCE`, `QUESTION`.
- **Report_Service**: The existing server-side moderation component defined in the moderation spec, reused for flagging Civic_Comments.
- **Disclaimer**: The fixed string "Educational summary, not legal advice." displayed on every Civic_Item card, every Explanation, and every Civic_Discussion thread.
- **Primary_Source**: A URL pointing to an official government or parliamentary website that is the direct source for the Civic_Item's content.
- **Draft**: A Civic_Item in `status = draft` that has not yet been reviewed or published.
- **Minor**: A user whose `age_bracket` is `minor` (under 18) as defined in foundation-auth.

---

## Requirements

### Requirement 1: Civic Feed — "What Changed?" Card Display

**User Story:** As a DivaCrew user, I want to see a daily curated feed of up to three civic items, so that I can stay informed about laws and policies that affect me without being overwhelmed.

#### Acceptance Criteria

1. THE App SHALL render a "What Changed?" screen accessible from the main navigation displaying the Civic_Feed.
2. THE Civic_Feed SHALL display a maximum of three published Civic_Items per calendar day (IST), ordered by published timestamp descending.
3. EACH Civic_Item card in the Civic_Feed SHALL display: the Item_Type label, the Category label, the 2-line plain-language summary, the Disclaimer ("Educational summary, not legal advice."), a link to the Primary_Source, an "Explain it like I'm 17" button, and a discussion/comment count.
4. THE App SHALL display the Civic_Feed as a vertically scrollable list of cards, each card being a distinct visual container.
5. WHEN no Civic_Items have been published for the current calendar day, THE App SHALL display a placeholder message such as "Nothing new today — check back soon 💛".
6. THE App SHALL render the Civic_Feed with identical content for every authenticated user; no per-user filtering, ranking, or personalisation SHALL be applied to the Civic_Feed.
7. THE App SHALL display the Civic_Feed using server-side rendering (SSR) for the initial page load.
8. THE Civic_Feed SHALL be accessible: each card SHALL use semantic HTML, every interactive element SHALL be keyboard navigable, and images or icons SHALL carry descriptive alt text.
9. WHEN a user taps the Primary_Source link on a Civic_Item card, THE App SHALL open the link in a new browser tab with `rel="noopener noreferrer"`.

---

### Requirement 2: Editorial Tool — Draft Creation

**User Story:** As an Editor, I want to create a draft Civic_Item in an admin tool, so that I can prepare content for review before it goes live.

#### Acceptance Criteria

1. THE App SHALL provide a draft-creation page at `/admin/civic/new` accessible only to authenticated users with role `editor` or `admin`; all other access attempts SHALL return a 403 response.
2. THE Editorial_Service SHALL accept the following fields when creating a Draft: `item_type` (required, one of the three Item_Type values), `category` (required, one of the seven Category values), `summary` (required, maximum 280 characters, plain text, no HTML), `primary_source_url` (required, must be a valid HTTPS URL), `source_text` (required, the full text extracted from the primary source, used by the Explain_Service), `author_id` (set automatically to the authenticated editor's ID).
3. THE Editorial_Service SHALL validate all draft fields with Zod before any database write; invalid inputs SHALL be rejected with a descriptive field-level error.
4. IF the `primary_source_url` field is absent or empty, THEN THE Editorial_Service SHALL reject the submission with the error "A primary source link is required before saving a draft."
5. THE App SHALL display a character counter next to the `summary` field and SHALL visually indicate when the count exceeds 280 characters.
6. WHEN a valid draft is submitted, THE Editorial_Service SHALL create a Civic_Item record with `status = draft`, `author_id`, and `created_at`; it SHALL NOT publish the item.
7. THE App SHALL display a confirmation to the editor: "Draft saved. It's now waiting for review 👀".
8. THE Editorial_Service SHALL allow an Editor to edit their own draft at `/admin/civic/{id}/edit` before it has been reviewed; edits SHALL reset the review status to `draft`.
9. THE Editorial_Service SHALL allow an Editor to delete their own draft before review; deleted drafts SHALL be soft-deleted (`deleted_at` set).
10. WHERE a user has role `admin`, THE Editorial_Service SHALL allow them to edit or soft-delete any draft regardless of authorship.

---

### Requirement 3: Editorial Tool — Review and Publish (4-Eyes Principle)

**User Story:** As a Reviewer, I want to approve or reject a draft Civic_Item written by another editor, so that no item is published without a second set of eyes.

#### Acceptance Criteria

1. THE App SHALL provide a review queue at `/admin/civic/review` accessible only to authenticated users with role `editor` or `admin`; all other access attempts SHALL return a 403 response.
2. THE Editorial_Service SHALL enforce the 4-eyes principle: the Reviewer approving a draft MUST NOT be the same user who authored it; attempts by the author to approve their own draft SHALL be rejected with the error "You cannot approve your own draft."
3. WHEN a Reviewer approves a Draft, THE Editorial_Service SHALL set the Civic_Item's `status` to `published`, record the `reviewer_id`, `reviewed_at`, and `published_at` timestamps.
4. WHEN a Reviewer rejects a Draft, THE Editorial_Service SHALL set the `status` back to `draft`, record a required rejection note (minimum 10 characters), notify the author via in-app notification with the rejection note, and NOT delete the draft.
5. IF a Draft does not have a non-empty `primary_source_url` at the time of approval, THEN THE Editorial_Service SHALL reject the approval attempt with the error "Cannot publish: primary source link is missing."
6. WHEN a Civic_Item is published, THE App SHALL make it immediately visible on the Civic_Feed for all users.
7. THE Editorial_Service SHALL prevent more than three Civic_Items from being published on the same calendar day (IST); attempts to publish a fourth item on the same day SHALL be rejected with the error "Daily limit of 3 items reached. Schedule for tomorrow."
8. THE App SHALL display the review queue ordered by `created_at` ascending (oldest drafts first) so that older drafts are reviewed first.
9. THE Editorial_Service SHALL record every approval and rejection action in a `civic_editorial_log` table containing: `actor_id`, `action` (`approved` or `rejected`), `item_id`, `note` (nullable for approvals, required for rejections), `timestamp`.

---

### Requirement 4: "Explain It Like I'm 17" — LLM-Powered Explanation

**User Story:** As a user, I want to tap "Explain it like I'm 17" on a civic item and receive a plain-language breakdown, so that I can understand what actually happened and what it means for me.

#### Acceptance Criteria

1. THE App SHALL display an "Explain it like I'm 17" button on every published Civic_Item card in the Civic_Feed.
2. WHEN a user taps the "Explain it like I'm 17" button, THE Explain_Service SHALL send a prompt to the LLM containing: the LLM_System_Prompt, the Civic_Item's `item_type`, `category`, and the full `source_text` — and NOTHING else (no user ID, no other items, no user history).
3. THE Explain_Service SHALL construct the LLM_System_Prompt as the fixed string: "You are a neutral educational summarizer. Use only the provided source text. Do not state opinions, recommend political positions, or make value judgments. When the source text does not answer a question, respond with 'I'm not sure.' Clearly distinguish confirmed facts from commentary."
4. THE LLM SHALL return an Explanation structured as exactly five named sections in this order: (1) What happened, (2) Why it matters, (3) Who it applies to, (4) What's still undecided, (5) Original source link.
5. THE Explain_Service SHALL validate that the LLM response contains all five required section headings before returning it to the client; responses missing any section SHALL be rejected and retried up to two times before returning an error.
6. THE App SHALL display the Explanation in a full-screen modal or dedicated page with each of the five sections clearly labelled.
7. THE App SHALL display the Disclaimer ("Educational summary, not legal advice.") at the top of every Explanation view.
8. THE App SHALL display the Primary_Source link (from the Civic_Item) at the bottom of every Explanation view as the "Original source link" section value.
9. WHEN the Explain_Service is loading a response, THE App SHALL display a loading indicator with the message "Thinking… 🤔".
10. IF the Explain_Service fails after retries, THEN THE App SHALL display the error message "Couldn't explain this right now — try again in a bit 💛" and SHALL NOT display a partial or malformed response.
11. THE Explain_Service SHALL cache the Explanation for each Civic_Item so that subsequent taps by any user return the cached response; the cache SHALL be invalidated if the Civic_Item's `source_text` or `primary_source_url` changes.
12. THE App SHALL show identical Explanations to all users for the same Civic_Item; no user-specific variation SHALL be applied to LLM outputs.

---

### Requirement 5: LLM Neutrality and Safety Constraints

**User Story:** As a product owner, I want the LLM to be strictly constrained to neutral, factual summarisation, so that DivaCrew never influences users' political views and never exposes minors to biased political content.

#### Acceptance Criteria

1. THE Explain_Service SHALL include the LLM_System_Prompt verbatim in every LLM invocation; the system prompt SHALL NOT be modifiable at runtime via any user input or editor field.
2. THE Explain_Service SHALL pass ONLY the following context to the LLM: the LLM_System_Prompt, the Civic_Item's `item_type`, `category`, and `source_text`; no user identifiers, demographic data, or other items SHALL be included in the LLM context.
3. THE Explain_Service SHALL NOT persist any user-identifying information alongside LLM requests or responses in application logs.
4. WHEN the source text does not contain information sufficient to answer a section, THE LLM SHALL respond with "I'm not sure." for that section; THE Explain_Service SHALL preserve this response as-is and SHALL NOT substitute alternative content.
5. THE Explain_Service SHALL treat any LLM output that contains political endorsements, calls to action, or explicit recommendations as invalid; such responses SHALL be discarded, retried up to two times, and if the problem persists, SHALL return the fallback error message defined in Requirement 4.
6. THE App SHALL display a notice beneath every Explanation: "This summary was generated from the linked source text only. It does not represent DivaCrew's views."
7. WHEN an Explanation is displayed to a user whose `age_bracket` is `minor`, THE App SHALL additionally display: "Ask a trusted adult if you have questions about how this affects you."

---

### Requirement 6: Discussion Threads — Labelled Comments

**User Story:** As a user, I want to comment on a civic item and label my comment as a fact, opinion, source, or question, so that the conversation stays structured, transparent, and easy to navigate.

#### Acceptance Criteria

1. THE App SHALL display a Civic_Discussion thread below or accessible from each published Civic_Item, showing all non-deleted Civic_Comments in chronological order.
2. THE App SHALL display the Disclaimer ("Educational summary, not legal advice.") at the top of every Civic_Discussion thread view.
3. WHEN a user submits a Civic_Comment, THE App SHALL require the user to select exactly one Discussion_Label (`FACT`, `OPINION`, `SOURCE`, `QUESTION`) before the submission is accepted; attempts to submit without a label SHALL be rejected with a validation error.
4. WHEN a user selects the `FACT` Discussion_Label, THE App SHALL display the prompt "Got a source? Add a link to back this up." and SHALL provide a URL input field; the URL is recommended but not required for `FACT` labels.
5. WHEN a user selects the `SOURCE` Discussion_Label, THE App SHALL require a non-empty URL field; submissions with the `SOURCE` label and an empty URL SHALL be rejected with the error "A source link is required for SOURCE comments."
6. THE App SHALL display each Civic_Comment's Discussion_Label as a visible badge on the comment card (e.g. "FACT", "OPINION", "SOURCE", "QUESTION") so readers can quickly identify the nature of each comment.
7. THE App SHALL allow users to filter the Civic_Discussion by Discussion_Label, showing only comments with the selected label.
8. THE App SHALL enforce a maximum Civic_Comment length of 500 characters; submissions exceeding this limit SHALL be rejected with a validation error.
9. THE App SHALL validate all Civic_Comment fields with Zod before any database write.
10. WHEN a Civic_Comment is submitted successfully, THE App SHALL optimistically append the comment to the thread and display a success toast.
11. WHERE a user's `age_bracket` is `minor`, THE App SHALL additionally display a prompt before comment submission: "Remember: this is a civic discussion. Keep it factual and kind 💛."

---

### Requirement 7: Discussion Moderation — Reuse of Report System

**User Story:** As a user, I want to report a Civic_Comment that violates community rules, so that harmful content in civic discussions is handled by the same moderation pipeline as the rest of the app.

#### Acceptance Criteria

1. THE App SHALL display a report affordance (accessible via a "⋮" menu) on every Civic_Comment visible to an authenticated user, except on the user's own comments.
2. WHEN a user selects "Report" on a Civic_Comment, THE App SHALL invoke the existing Report_Service as defined in the moderation spec, passing `content_type = civic_comment` and the Civic_Comment's ID.
3. THE Report_Service SHALL accept `civic_comment` as a valid `content_type` and route it into the existing Moderation_Queue with the appropriate severity derived from the selected Report_Reason.
4. THE App SHALL NOT implement a separate or parallel moderation queue for Civic_Comments; all civic comment reports SHALL appear in the shared Moderation_Queue under `/admin/moderation`.
5. WHEN a moderator takes a `remove_content` action on a Civic_Comment, THE Editorial_Service SHALL soft-delete the comment (set `deleted_at`) and THE App SHALL replace the comment text with "This comment was removed." in the discussion thread.
6. THE App SHALL apply all moderation spec RLS policies to the `civic_comments` table: users can read non-deleted comments on published items; users can insert their own comments; only moderators can read deleted comments.

---

### Requirement 8: Source Link Enforcement

**User Story:** As a product owner, I want the system to make it technically impossible to publish a Civic_Item without a primary source link, so that every piece of civic information is traceable to an official source.

#### Acceptance Criteria

1. THE Editorial_Service SHALL enforce a NOT NULL constraint on the `primary_source_url` column of the `civic_items` table at the database level via a Supabase migration.
2. THE Editorial_Service SHALL enforce a CHECK constraint on the `civic_items` table that `primary_source_url` matches the pattern `^https://` (must be an HTTPS URL).
3. THE Editorial_Service SHALL perform a Zod validation check that `primary_source_url` is a valid URL before any insert or update operation; invalid URLs SHALL be rejected with a descriptive error.
4. THE App SHALL display the `primary_source_url` as a visible, tappable link on every Civic_Item card with the label "Official source" or equivalent.
5. IF a Reviewer attempts to approve a Draft where `primary_source_url` is missing or does not match the HTTPS pattern, THEN THE Editorial_Service SHALL reject the approval with the error "Cannot publish: primary source link is missing or invalid."
6. THE Explain_Service SHALL include the `primary_source_url` in the Explanation output as the "Original source link" section and SHALL NOT omit it even if the LLM output does not reference it.

---

### Requirement 9: No Personalisation of Civic Content

**User Story:** As a product owner, I want the civic feed and explanations to be identical for every user, so that DivaCrew never serves different political or civic information to different users based on their profile or behaviour.

#### Acceptance Criteria

1. THE Editorial_Service SHALL return the same set of published Civic_Items to every authenticated user; the query SHALL NOT filter, reorder, or exclude items based on any user attribute (age, location, interests, behaviour, history).
2. THE Explain_Service SHALL return the same cached Explanation for a given Civic_Item to every user; Explanation content SHALL NOT vary based on user identity, demographics, or history.
3. THE App SHALL NOT display any "recommended for you" or personalisation signals on the Civic_Feed or on any Explanation screen.
4. THE App SHALL NOT track or store which Civic_Items or Explanations a user has viewed for the purpose of personalising future civic content.
5. THE App SHALL NOT A/B test civic content variants on different user segments.

---

### Requirement 10: Disclaimer Display

**User Story:** As a product owner, I want "Educational summary, not legal advice." to appear on every civic surface, so that users always understand the nature and limits of the content they are reading.

#### Acceptance Criteria

1. THE App SHALL display the Disclaimer string "Educational summary, not legal advice." on every Civic_Item card in the Civic_Feed.
2. THE App SHALL display the Disclaimer at the top of every Explanation view, before the five structured sections.
3. THE App SHALL display the Disclaimer at the top of every Civic_Discussion thread view.
4. THE App SHALL render the Disclaimer in a visually distinct style (e.g. smaller text, muted colour) that differentiates it from the item summary and comment body without making it invisible or illegible.
5. THE App SHALL NOT allow an Editor to remove, override, or customise the Disclaimer text via the editorial tool; the Disclaimer SHALL be hardcoded in the UI component and not sourced from the database.
6. THE App SHALL display the Disclaimer in a font size no smaller than 12 px and with sufficient contrast meeting WCAG 2.1 AA.

---

### Requirement 11: RLS and Data Access Policies

**User Story:** As a developer, I want Row Level Security policies on all civic tables, so that regular users cannot read drafts, editors cannot approve their own work, and user data is never exposed to the LLM.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on all new tables introduced by this spec: `civic_items`, `civic_comments`, `civic_editorial_log`, `civic_explanation_cache`.
2. THE App SHALL allow authenticated users to SELECT only rows from `civic_items` where `status = published` and `deleted_at IS NULL`; drafts and deleted items SHALL be invisible to non-editor roles via RLS.
3. THE App SHALL allow users with role `editor` or `admin` to SELECT all rows (including drafts) in `civic_items` via RLS.
4. THE App SHALL allow authenticated users to INSERT into `civic_items` only via a trusted server-side function; direct client inserts SHALL be blocked by RLS.
5. THE App SHALL allow authenticated users to SELECT rows from `civic_comments` only where the associated `civic_item` has `status = published` and where `deleted_at IS NULL` on the comment.
6. THE App SHALL allow authenticated users to INSERT into `civic_comments` only via a server-side route handler using the authenticated user's ID.
7. THE App SHALL allow only users with role `editor` or `admin` to SELECT from `civic_editorial_log`; all other roles SHALL be denied.
8. THE App SHALL deny all access to civic tables for unauthenticated requests.

---

### Requirement 12: LLM Output Structure Tests

**User Story:** As a developer, I want automated tests that verify the LLM output follows the required five-section structure and that the neutrality constraints are applied, so that a regression in LLM handling never silently produces malformed or biased explanations.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when the Explain_Service receives a well-formed LLM response with all five section headings, it returns a valid Explanation object without error.
2. THE test suite SHALL include a Vitest unit test verifying: when the Explain_Service receives a response missing one or more section headings, it rejects the response and triggers a retry.
3. THE test suite SHALL include a Vitest unit test verifying: after three consecutive malformed LLM responses (missing sections), the Explain_Service returns the user-facing fallback error and does NOT return a partial Explanation.
4. THE test suite SHALL include a Vitest unit test verifying: the LLM_System_Prompt passed in every Explain_Service invocation exactly matches the required fixed string and contains the phrases "neutral educational summarizer", "Do not state opinions", "recommend political positions", "I'm not sure", and "Clearly distinguish confirmed facts from commentary."
5. THE test suite SHALL include a Vitest unit test verifying: the Explain_Service payload sent to the LLM contains ONLY `system_prompt`, `item_type`, `category`, and `source_text` — and does NOT contain any user ID, user demographic data, or fields from other Civic_Items.
6. THE test suite SHALL include a round-trip property: FOR ALL valid Civic_Items (varying `item_type`, `category`, and `source_text` of arbitrary length and character set), THE Explain_Service SHALL produce an Explanation containing all five required section keys and a non-empty `original_source_link` matching the item's `primary_source_url`. (Round-trip: create item → call Explain_Service → assert structure complete and source link present)
7. THE test suite SHALL include a Vitest unit test verifying: when the LLM output contains a political endorsement string (e.g. "you should support", "vote for", "this is the right choice"), THE Explain_Service rejects it as invalid and does NOT return it to the client.

---

### Requirement 13: Publishing Source Link Tests

**User Story:** As a developer, I want automated tests that verify a Civic_Item cannot be published without a primary source link, so that the source requirement is always enforced end-to-end.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: calling the Editorial_Service's publish function with a draft that has `primary_source_url = null` returns an error and does NOT change the item's status to `published`.
2. THE test suite SHALL include a Vitest unit test verifying: calling the Editorial_Service's publish function with a draft that has `primary_source_url = ""` (empty string) returns an error and does NOT change the item's status to `published`.
3. THE test suite SHALL include a Vitest unit test verifying: calling the Editorial_Service's publish function with a `primary_source_url` that is a valid HTTPS URL succeeds and sets the item's status to `published`.
4. THE test suite SHALL include a Vitest unit test verifying: calling the Editorial_Service's publish function with a `primary_source_url` that uses HTTP (not HTTPS) returns a validation error.
5. THE test suite SHALL include a Vitest unit test verifying: calling the Editorial_Service's publish function where the author ID and reviewer ID are the same returns the error "You cannot approve your own draft."
6. THE test suite SHALL include a round-trip property: FOR ALL drafts with a valid `primary_source_url` (varying URL paths and query strings on `gov.in`, `nic.in`, or `parliament.gov.in` domains), THE Editorial_Service SHALL successfully publish the item, and the resulting published Civic_Item SHALL carry the same `primary_source_url` value without modification. (Round-trip: create draft → publish → read published item → assert source URL preserved exactly)
7. THE test suite SHALL include a Playwright end-to-end test simulating: an editor creates a draft, attempts to submit it without a source link (verifying the UI blocks submission), adds a source link, submits, a second editor approves it, and the item appears on the Civic_Feed.
