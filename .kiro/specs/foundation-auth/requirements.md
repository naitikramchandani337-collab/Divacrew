# Requirements Document

## Introduction

DivaCrew is a women-only social app for girls in India (college students, teens 16+, and young professionals). This spec covers the app's foundational layer: phone-OTP sign-up via Supabase Auth, invite-only access control, onboarding (nickname, avatar, city, age bracket, consent), a verification status architecture for future liveness checks, privacy-first data handling with DPDP Act compliance, the basic app shell (bottom tabs, dark/light theme), and core settings (privacy, block list, account deletion). The audience may include minors (16–17), so stricter data defaults and age-gating apply throughout.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **Auth_Service**: The Supabase Auth module handling phone OTP issuance and verification.
- **Rate_Limiter**: The server-side component in `/lib/security` that enforces request-rate thresholds.
- **Invite_Service**: The server-side component that validates, redeems, and issues invite codes.
- **Onboarding_Service**: The server-side component that collects and persists profile data during sign-up.
- **Profile**: A row in the `profiles` table representing a registered user.
- **Consent_Record**: A row in the `consents` table capturing that a user accepted the privacy notice at a specific version and timestamp.
- **Verification_Status**: One of the enum values `unverified`, `pending`, or `verified` stored on a Profile.
- **Age_Bracket**: A stored classification (`minor` for under 18, `adult` for 18 and over) derived from date of birth at collection time; the exact date of birth is not persisted after classification.
- **Minor**: A user whose Age_Bracket is `minor` (under 18).
- **Adult**: A user whose Age_Bracket is `adult` (18 or over).
- **Invite_Code**: A unique, single-use alphanumeric token that grants one new user access to sign up.
- **Inviter**: The verified member who generated an Invite_Code that was redeemed by a new user.
- **App_Shell**: The persistent UI frame comprising the bottom tab navigation bar, theme system, and global layout.
- **Bottom_Nav**: The fixed bottom navigation bar with tabs: Feed, Crews, Fits, Check-in, Me.
- **Theme_System**: The dark/light mode implementation using Tailwind CSS and a pastel playful palette.
- **Settings_Service**: The server-side component handling privacy settings, block list, and account deletion.

---

## Requirements

### Requirement 1: Phone OTP Sign-Up

**User Story:** As a new user, I want to sign up with my phone number and a one-time passcode, so that I can create an account without a password.

#### Acceptance Criteria

1. WHEN a user submits a valid Indian or international phone number on the sign-up screen, THE Auth_Service SHALL send an OTP to that number via Supabase Auth.
2. WHEN a user submits a phone number, THE Rate_Limiter SHALL allow a maximum of 3 OTP send attempts per phone number per 10-minute window.
3. IF a user exceeds the OTP send rate limit, THEN THE Auth_Service SHALL return an error message stating the limit has been reached and display the earliest time a new OTP can be requested.
4. WHEN a user submits a correct OTP within 5 minutes of issuance, THE Auth_Service SHALL create or sign in the user session.
5. IF a user submits an incorrect or expired OTP, THEN THE Auth_Service SHALL return a descriptive error and SHALL NOT reveal whether the phone number exists in the system.
6. WHEN a user submits an OTP, THE Rate_Limiter SHALL allow a maximum of 5 verification attempts per phone number per 10-minute window before locking further attempts for that window.
7. THE Auth_Service SHALL never log a phone number in plain text in application logs or error traces.

---

### Requirement 2: Invite-Only Access

**User Story:** As a product owner, I want new sign-ups to require a valid invite code, so that DivaCrew launches as a curated, invite-only community.

#### Acceptance Criteria

1. WHEN a new user has verified their OTP, THE Invite_Service SHALL require the user to enter an Invite_Code before proceeding to onboarding.
2. WHEN a user submits an Invite_Code, THE Invite_Service SHALL validate that the code exists, has not been redeemed, and has not expired.
3. IF a submitted Invite_Code is invalid, expired, or already redeemed, THEN THE Invite_Service SHALL return a descriptive error and SHALL NOT allow the user to proceed to onboarding.
4. WHEN a valid Invite_Code is redeemed, THE Invite_Service SHALL mark the code as redeemed, record the redeeming user's ID, record the timestamp, and record the Inviter's user ID as `inviter_id` on the new user's Profile.
5. WHEN a verified member's account reaches the `verified` Verification_Status, THE Invite_Service SHALL generate exactly 3 Invite_Codes for that member.
6. THE Invite_Service SHALL record the `inviter_id` on the new user's Profile so that future moderation actions can reference and restrict the Inviter's invite privileges.
7. WHEN a user submits an Invite_Code, THE Rate_Limiter SHALL allow a maximum of 5 invalid attempts per session before locking invite entry for that session.

---

### Requirement 3: Onboarding Flow

**User Story:** As a new user who has passed invite validation, I want to complete a guided onboarding flow, so that my profile is set up with the information DivaCrew needs.

#### Acceptance Criteria

1. WHEN a user begins onboarding, THE Onboarding_Service SHALL present steps in this order: (1) nickname, (2) avatar, (3) city, (4) date-of-birth entry for age classification, (5) consent screen.
2. WHEN a user submits a nickname, THE Onboarding_Service SHALL accept nicknames between 2 and 30 characters and reject values that contain only whitespace or prohibited characters.
3. WHEN a user selects an avatar, THE App SHALL offer at least 6 preset avatar options and an option to upload a custom image.
4. WHERE a user uploads a custom avatar, THE App SHALL accept JPEG, PNG, and WebP formats up to 5 MB and store the image in Supabase Storage.
5. WHEN a user submits a date of birth indicating an age of 15 or below, THE Onboarding_Service SHALL reject the submission and display a message stating the minimum age is 16.
6. WHEN a user submits a date of birth, THE Onboarding_Service SHALL compute and store the Age_Bracket (`minor` for under 18, `adult` for 18 and over) on the Profile and SHALL NOT persist the exact date of birth after classification.
7. WHEN a user's Age_Bracket is `minor`, THE Onboarding_Service SHALL set the following privacy defaults on the Profile: direct messages restricted to confirmed connections, profile visibility set to private, and location sharing disabled.
8. WHEN a user reaches the consent screen, THE App SHALL display a plain-language privacy notice in English (and optionally Hindi), summarising what data is collected, how it is used, the right to delete data, and a clear statement that DivaCrew is a space for women and girls.
9. WHEN a user taps "I Agree" on the consent screen, THE Onboarding_Service SHALL create a Consent_Record containing the user ID, privacy notice version, acceptance timestamp, and Age_Bracket at time of consent.
10. IF a user does not tap "I Agree", THEN THE Onboarding_Service SHALL not proceed and SHALL display the option to review the privacy notice again or exit sign-up.
11. WHERE a user's Age_Bracket is `minor`, THE App SHALL display an additional notice on the consent screen stating that a parent or guardian should be aware the user is joining DivaCrew, in accordance with India's DPDP Act.

---

### Requirement 4: Verification Status Architecture

**User Story:** As a product owner, I want a verification status field and a pluggable architecture for identity verification, so that I can integrate a third-party liveness vendor later without restructuring the database.

#### Acceptance Criteria

1. THE App SHALL store a `verification_status` field on every Profile with the allowed values `unverified`, `pending`, and `verified`.
2. WHEN a Profile is created, THE Onboarding_Service SHALL set `verification_status` to `unverified`.
3. THE App SHALL define a server-side verification interface (e.g., a TypeScript interface in `/lib`) that accepts a user ID and returns a verification outcome, so that a third-party selfie liveness vendor can be integrated by implementing this interface.
4. IF a verification flow is initiated and a selfie or liveness image is captured, THEN THE App SHALL delete the image from all storage and memory immediately after the verification result is received and SHALL NOT persist it.
5. WHEN a verification attempt is submitted, THE Rate_Limiter SHALL allow a maximum of 3 verification attempts per user per 24-hour window.
6. WHEN a verification outcome of `verified` is received, THE App SHALL update the Profile's `verification_status` to `verified`.
7. WHEN a verification outcome is inconclusive or rejected, THE App SHALL update the Profile's `verification_status` to `unverified` and notify the user with a plain-language explanation.

---

### Requirement 5: Row-Level Security Policies

**User Story:** As a developer, I want RLS policies on the profiles, invites, and consents tables, so that users can only access and modify data they are authorised to see.

#### Acceptance Criteria

1. THE App SHALL enable Row Level Security on the `profiles`, `invites`, and `consents` tables in Supabase Postgres.
2. WHILE a user is authenticated, THE App SHALL allow that user to read and update only their own row in the `profiles` table.
3. WHILE a user is authenticated, THE App SHALL allow that user to read only their own rows in the `consents` table.
4. THE App SHALL not allow any client to insert directly into the `consents` table; inserts SHALL be performed only via a trusted server-side function with the service role.
5. WHILE a user is authenticated, THE App SHALL allow that user to read only Invite_Codes they own (i.e., where `owner_id` equals their user ID).
6. THE App SHALL not allow any client to insert or update rows in the `invites` table directly; all invite mutations SHALL be performed via server-side functions.
7. THE App SHALL deny all access to the `profiles`, `invites`, and `consents` tables for unauthenticated requests.

---

### Requirement 6: App Shell and Navigation

**User Story:** As a user, I want a consistent app shell with bottom navigation and theme support, so that I can move between sections and use the app comfortably in light or dark conditions.

#### Acceptance Criteria

1. THE App SHALL render a Bottom_Nav bar with five tabs: Feed, Crews, Fits, Check-in, and Me, visible on all authenticated screens.
2. WHEN a user taps a Bottom_Nav tab, THE App SHALL navigate to the corresponding route without a full page reload.
3. THE App SHALL implement a Theme_System supporting a dark mode and a light mode using a pastel playful colour palette via Tailwind CSS.
4. WHEN the device's system preference changes between dark and light mode, THE Theme_System SHALL update the App's theme to match without requiring a manual toggle.
5. THE App SHALL allow a user to manually override the theme preference in Settings, and THE Theme_System SHALL persist that preference across sessions.
6. THE App SHALL meet WCAG 2.1 AA contrast ratios for text and interactive elements in both dark and light themes.
7. THE Bottom_Nav SHALL be keyboard navigable and include accessible labels for each tab so that screen readers can identify each destination.

---

### Requirement 7: Settings — Privacy, Block List, and Account Deletion

**User Story:** As a user, I want settings for privacy controls, blocking other users, and deleting my account, so that I can manage my experience and data.

#### Acceptance Criteria

1. THE App SHALL provide a Settings screen accessible from the Me tab containing sections for: Privacy Settings, Block List, and Delete My Account.
2. WHEN a user updates a privacy setting (profile visibility, DM permissions, location sharing), THE Settings_Service SHALL persist the change to the user's Profile immediately.
3. WHEN a user blocks another user, THE Settings_Service SHALL add an entry to the `blocks` table and THE App SHALL hide the blocked user's content from the blocking user's feed and search results.
4. WHEN a user taps "Delete My Account", THE App SHALL display a confirmation screen describing what data will be deleted and stating that the action is irreversible.
5. WHEN a user confirms account deletion, THE Settings_Service SHALL: (a) delete or anonymise all user-generated content, (b) delete the Profile row or mark it with a soft-delete flag, (c) revoke all Invite_Codes issued by that user that have not yet been redeemed, and (d) request deletion of the Supabase Auth account.
6. WHEN account deletion completes, THE App SHALL sign the user out and navigate to the sign-up screen.
7. IF account deletion fails partially, THEN THE Settings_Service SHALL log the failure (without PII) and queue a retry so that the deletion eventually completes.

---

### Requirement 8: OTP Rate-Limit Tests

**User Story:** As a developer, I want automated tests for OTP rate limiting, so that I can verify the enforcement logic is correct and regressions are caught.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests (Vitest) that verify: after 3 OTP send requests for the same phone number within 10 minutes, the fourth request returns a rate-limit error.
2. THE test suite SHALL verify that after the 10-minute window elapses, OTP requests for the same phone number are accepted again.
3. THE test suite SHALL verify that the rate-limit counter is scoped per phone number and does not affect OTP requests from a different phone number.
4. THE test suite SHALL include a Playwright end-to-end test that simulates a user exhausting OTP attempts and confirms the correct error message and wait time are displayed.

---

### Requirement 9: Invite Redemption Tests

**User Story:** As a developer, I want automated tests for invite code redemption, so that I can verify that invalid, expired, and already-used codes are correctly rejected and that valid redemptions are correctly recorded.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests (Vitest) that verify: a valid, unredeemed Invite_Code is accepted and the redeeming user's ID and `inviter_id` are recorded correctly.
2. THE test suite SHALL verify that an already-redeemed Invite_Code returns an error and does not update any state.
3. THE test suite SHALL verify that an expired Invite_Code returns an error and does not update any state.
4. THE test suite SHALL verify that a non-existent Invite_Code returns an error and does not update any state.
5. THE test suite SHALL include a round-trip property: FOR ALL valid Invite_Codes generated by the Invite_Service, redemption by a new user SHALL produce a Profile with an `inviter_id` equal to the code's owner ID. (Round-trip: generate → redeem → assert `inviter_id`)
6. THE test suite SHALL include a Playwright end-to-end test covering the full invite-entry step in the sign-up flow, verifying that an invalid code shows an error and a valid code advances to onboarding.
