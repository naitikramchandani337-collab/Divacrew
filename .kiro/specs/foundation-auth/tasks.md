# Implementation Plan: Foundation Auth

## Overview

Bootstrap the DivaCrew Next.js PWA from scratch: project scaffolding, Supabase schema with RLS, server-side business logic (rate limiter, invite service, onboarding service, verification stub, settings service), Tailwind theme, shared UI components, auth/onboarding/app-shell pages, settings screens, and the full test suite. Tasks are ordered so that every dependency is satisfied before the thing that needs it is built: DB migrations → RLS → lib services → shared UI → auth pages → onboarding pages → app shell → settings → tests.

---

## Tasks

- [x] 1. Project setup and Supabase client configuration
  - Scaffold a Next.js 14 App Router project with TypeScript strict mode and Tailwind CSS
  - Install and configure dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `fast-check`, `vitest`, `@playwright/test`, `lucide-react`
  - Create `/lib/supabase/server.ts` — server client using `createServerClient` from `@supabase/ssr` (reads cookies)
  - Create `/lib/supabase/client.ts` — browser client using `createBrowserClient`
  - Add `/app/api/auth/callback/route.ts` — Supabase auth callback handler that exchanges the code for a session
  - Add environment variable stubs in `.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Configure Vitest (`vitest.config.ts`) with `@vitejs/plugin-react` and path alias `@/`
  - Configure Playwright (`playwright.config.ts`) targeting `localhost:3000`
  - _Requirements: 1.1, 6.3_

- [-] 2. Database migrations
  - [x] 2.1 Create `profiles` table migration (`/supabase/migrations/0001_profiles.sql`)
    - Define all columns: `id`, `nickname`, `avatar_url`, `city`, `age_bracket`, `verification_status`, `profile_visibility`, `dm_permissions`, `location_sharing`, `inviter_id`, `deleted_at`, `created_at`, `updated_at`
    - Include all CHECK constraints and DEFAULT values as specified in the design
    - Add indexes: `idx_profiles_inviter_id`, `idx_profiles_verification_status`, `idx_profiles_deleted_at`
    - _Requirements: 3.6, 3.7, 4.1, 4.2, 5.1_

  - [x] 2.2 Create `invites` table migration (`/supabase/migrations/0002_invites.sql`)
    - Define columns: `id`, `code`, `owner_id`, `redeemed_by`, `redeemed_at`, `expires_at` (default `now() + 30 days`), `created_at`
    - Add indexes: `idx_invites_code`, `idx_invites_owner_id`, `idx_invites_redeemed_by`
    - _Requirements: 2.2, 2.4, 5.1_

  - [x] 2.3 Create `consents` table migration (`/supabase/migrations/0003_consents.sql`)
    - Define columns: `id`, `user_id`, `privacy_notice_version`, `age_bracket`, `accepted_at`, `created_at`
    - Add index: `idx_consents_user_id`
    - _Requirements: 3.9, 5.1_

  - [x] 2.4 Create `blocks` table migration (`/supabase/migrations/0004_blocks.sql`)
    - Define columns: `id`, `blocker_id`, `blocked_id`, `created_at`
    - Add UNIQUE constraint `(blocker_id, blocked_id)` and self-block CHECK
    - Add indexes: `idx_blocks_blocker_id`, `idx_blocks_blocked_id`
    - _Requirements: 7.3, 5.1_

  - [x] 2.5 Create `contact_requests` table migration (`/supabase/migrations/0005_contact_requests.sql`)
    - Define columns: `id`, `requester_id`, `target_id`, `status` (pending/accepted/rejected), `created_at`, `updated_at`
    - Add UNIQUE constraint `(requester_id, target_id)` and self-request CHECK
    - Add indexes: `idx_contact_requests_requester_id`, `idx_contact_requests_target_id`
    - _Requirements: 5.1_

  - [ ] 2.6 Create `record_consent` Postgres function (`/supabase/functions/record_consent.sql`)
    - Write a `SECURITY DEFINER` function that accepts `p_user_id`, `p_version`, `p_age_bracket` and inserts into `consents`
    - Ensures no direct client insert path exists for consents
    - _Requirements: 5.4_

- [ ] 3. Row-Level Security policies (`/supabase/migrations/0006_rls_policies.sql`)
  - Enable RLS on all five tables: `profiles`, `invites`, `consents`, `blocks`, `contact_requests`
  - `profiles`: SELECT and UPDATE for own row only (`id = auth.uid() AND deleted_at IS NULL`); no client INSERT or DELETE policy
  - `invites`: SELECT for own codes (`owner_id = auth.uid()`); no client INSERT/UPDATE/DELETE policy
  - `consents`: SELECT for own records (`user_id = auth.uid()`); no client INSERT policy
  - `blocks`: SELECT, INSERT (`blocker_id = auth.uid()`), DELETE (`blocker_id = auth.uid()`)
  - `contact_requests`: SELECT for requester or target, INSERT for requester, UPDATE for target
  - Add a `deny_unauthenticated` default-deny baseline (no permissive policy for anon role on any table)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 4. Checkpoint — verify migrations and RLS compile cleanly
  - Run `supabase db reset` against the local Supabase instance; confirm all migrations apply without errors
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Rate limiter (`/lib/security/`)
  - [ ] 5.1 Define the `RateLimiter` interface and limit constants
    - Write `/lib/security/rate-limiter.ts` with `RateLimitResult` type and `RateLimiter` interface as specified in design
    - Write `/lib/security/limits.ts` with the four limit configurations: `OTP_SEND` (3/10 min), `OTP_VERIFY` (5/10 min), `INVITE` (5/session), `VERIFY` (3/24 hr)
    - _Requirements: 1.2, 1.6, 2.7, 4.5_

  - [ ] 5.2 Implement `UpstashRateLimiter` (Redis-backed)
    - Implement the `RateLimiter` interface in `/lib/security/upstash-rate-limiter.ts` using Upstash Redis (`@upstash/redis`)
    - Use atomic `INCR` + `EXPIREAT` operations; derive `resetAt` from the Redis TTL
    - Export a singleton `rateLimiter` instance that reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from env
    - _Requirements: 1.2, 1.6, 2.7, 4.5_

  - [ ]* 5.3 Write property tests for rate limiter — Property 1: per-entity window enforcement
    - **Property 1: Rate limiter enforces per-entity window**
    - **Validates: Requirements 1.2, 1.6, 2.7, 4.5, 8.1, 8.2, 8.3**
    - Use `fast-check` to generate varied `(key, maxAttempts, windowMs)` inputs; assert that attempt #(maxAttempts+1) is always denied within the window and that a simulated window reset restores the counter
    - Tag: `// Feature: foundation-auth, Property 1`

  - [ ]* 5.4 Write property tests for rate limiter — Property 2: no cross-key contamination
    - **Property 2: Rate limiter is scoped per key — no cross-contamination**
    - **Validates: Requirements 8.3**
    - Use `fast-check` to generate two distinct keys K1 and K2; exhaust K1's limit and assert K2 remains unaffected
    - Tag: `// Feature: foundation-auth, Property 2`

- [ ] 6. Auth schemas and OTP flow (`/lib/auth/`)
  - [ ] 6.1 Write Zod validation schemas (`/lib/auth/schemas.ts`)
    - Export `PhoneSchema` (E.164 regex), `OtpTokenSchema` (6-digit string), `InviteCodeSchema` (8-char uppercase alphanumeric)
    - _Requirements: 1.1, 2.2_

  - [ ] 6.2 Implement OTP server actions (`/lib/auth/otp-flow.ts`)
    - `sendOtp(phone)`: validates phone with `PhoneSchema`, calls `rateLimiter.check(otp_send:{phone})`, calls `supabase.auth.signInWithOtp({ phone })`. Never logs phone in plain text.
    - `verifyOtp(phone, token)`: validates token, calls `rateLimiter.check(otp_verify:{phone})`, calls `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
    - Both return typed `{ success, error, resetAt? }` shapes; error messages must be identical regardless of phone existence
    - Mark the file with `'use server'`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 6.3 Write property test for OTP error — Property 3: error response never reveals phone existence
    - **Property 3: OTP error response never reveals phone existence**
    - **Validates: Requirements 1.5**
    - Use `fast-check` to generate arbitrary invalid OTP tokens; mock Supabase to return a "not found" variant and a "wrong code" variant; assert the client-facing error message is identical in both cases
    - Tag: `// Feature: foundation-auth, Property 3`

- [ ] 7. Invite service (`/lib/invite/`)
  - [ ] 7.1 Implement invite code generation (`/lib/invite/invite-codegen.ts`)
    - Export `generateInviteCode(): string` — generates an 8-character uppercase alphanumeric string using `crypto.randomBytes`
    - _Requirements: 2.5_

  - [ ] 7.2 Implement `InviteService` (`/lib/invite/invite-service.ts`)
    - `validateAndRedeem(code, redeemingUserId)`: validates code format, calls rate limiter (`invite:{sessionId}`), queries `invites` table, checks `redeemed_by IS NULL` and `expires_at > now()`, updates the row atomically (set `redeemed_by`, `redeemed_at`), returns `{ inviterId }`
    - `generateForUser(userId, count = 3)`: generates `count` codes, inserts into `invites` with `owner_id = userId`
    - `revokeUnredeemedByUser(userId)`: deletes all invite rows where `owner_id = userId AND redeemed_by IS NULL`
    - Use the service-role Supabase client for all writes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 7.3 Write property tests for invite service — Property 4: redemption round-trip records correct inviter_id
    - **Property 4: Invite redemption round-trip records correct inviter_id**
    - **Validates: Requirements 2.4, 9.1, 9.5**
    - Use `fast-check` to generate valid (ownerId, redeemingUserId) pairs; mock the DB; assert `profile.inviter_id === ownerId`, `invite.redeemed_by === redeemingUserId`
    - Tag: `// Feature: foundation-auth, Property 4`

  - [ ]* 7.4 Write property tests for invite service — Property 5: verified user receives exactly 3 invite codes
    - **Property 5: Verified user always receives exactly 3 invite codes**
    - **Validates: Requirements 2.5**
    - Assert that `generateForUser(userId)` inserts exactly 3 rows regardless of any prior state
    - Tag: `// Feature: foundation-auth, Property 5`

  - [ ]* 7.5 Write unit tests for invite service — invalid/expired/redeemed/non-existent codes
    - Verify already-redeemed code returns an error and does not mutate state (Requirement 9.2)
    - Verify expired code returns an error and does not mutate state (Requirement 9.3)
    - Verify non-existent code returns an error and does not mutate state (Requirement 9.4)
    - _Requirements: 9.2, 9.3, 9.4_

- [ ] 8. Onboarding service and age bracket logic (`/lib/onboarding/`)
  - [ ] 8.1 Implement age bracket pure functions (`/lib/onboarding/age-bracket.ts`)
    - `computeAgeBracket(dateOfBirth: string): AgeBracket` — ISO date → `'minor'` if age < 18, `'adult'` if age >= 18
    - `validateAge(dateOfBirth: string): { valid: boolean; reason?: string }` — rejects if age <= 15 with `'AGE_TOO_YOUNG'` reason
    - These are pure functions with no DB calls
    - _Requirements: 3.5, 3.6_

  - [ ] 8.2 Write Zod validation schemas (`/lib/onboarding/schemas.ts`)
    - `NicknameSchema`: 2–30 chars, non-whitespace-only, no prohibited chars (`<>'"\/`)
    - `DobSchema`: ISO date string
    - `AvatarUploadSchema`: MIME type enum + max 5 MB size
    - _Requirements: 3.2, 3.4_

  - [ ] 8.3 Implement `OnboardingService` (`/lib/onboarding/onboarding-service.ts`)
    - `createProfile(input)`: validates nickname, computes `age_bracket`, applies minor privacy defaults (`profile_visibility = 'private'`, `dm_permissions = 'connections'`, `location_sharing = false`) when `age_bracket === 'minor'`, sets `verification_status = 'unverified'`, inserts into `profiles` via service-role client. DOB is **not** stored in any column.
    - `recordConsent(userId, ageBracket)`: calls the `record_consent` Postgres function via RPC; passes current `privacy_notice_version` constant
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.9, 4.2_

  - [ ]* 8.4 Write property tests for onboarding — Property 6: nickname validator
    - **Property 6: Nickname validator accepts valid inputs and rejects invalid inputs**
    - **Validates: Requirements 3.2**
    - Use `fast-check` to generate strings of varying length and character content; assert `NicknameSchema.safeParse` accepts iff `2 ≤ trim().length ≤ 30` and no prohibited chars
    - Tag: `// Feature: foundation-auth, Property 6`

  - [ ]* 8.5 Write property tests for onboarding — Property 7: avatar file validator
    - **Property 7: Avatar file validator enforces type and size constraints**
    - **Validates: Requirements 3.4**
    - Use `fast-check` to generate `(mimeType, sizeBytes)` pairs; assert `AvatarUploadSchema.safeParse` accepts iff type is in allowed set and size ≤ 5,242,880 bytes
    - Tag: `// Feature: foundation-auth, Property 7`

  - [ ]* 8.6 Write property tests for onboarding — Property 8: age bracket computation and no DOB persistence
    - **Property 8: Age bracket computation is correct and DOB is never persisted**
    - **Validates: Requirements 3.5, 3.6**
    - Use `fast-check` with `fc.date()` to generate arbitrary DOBs; assert `computeAgeBracket` returns `'minor'` iff age < 18, `'adult'` iff age >= 18; assert the returned profile object from `createProfile` contains no field equal to the input DOB string
    - Tag: `// Feature: foundation-auth, Property 8`

  - [ ]* 8.7 Write property tests for onboarding — Property 9: minor users receive restricted privacy defaults
    - **Property 9: Minor users always receive restricted privacy defaults**
    - **Validates: Requirements 3.7, 3.11**
    - Use `fast-check` to generate minor DOBs; assert the profile created by `OnboardingService` has `dm_permissions = 'connections'`, `profile_visibility = 'private'`, `location_sharing = false`
    - Tag: `// Feature: foundation-auth, Property 9`

  - [ ]* 8.8 Write property tests for onboarding — Property 10: consent record is always complete
    - **Property 10: Consent record is always complete**
    - **Validates: Requirements 3.9**
    - Use `fast-check` to generate `(userId, ageBracket)` pairs; assert the created `Consent_Record` has no null fields and all four required fields are set correctly
    - Tag: `// Feature: foundation-auth, Property 10`

  - [ ]* 8.9 Write property tests for onboarding — Property 11: new profiles start with verification_status = 'unverified'
    - **Property 11: New profiles always start with verification_status = 'unverified'**
    - **Validates: Requirements 4.2**
    - Use `fast-check` to generate varied `OnboardingInput` values; assert all created profiles have `verification_status === 'unverified'`
    - Tag: `// Feature: foundation-auth, Property 11`

- [ ] 9. Verification interface and stub provider (`/lib/verification/`)
  - Create `/lib/verification/verification-interface.ts` — export `VerificationOutcome` type and `VerificationProvider` interface as specified in design
  - Create `/lib/verification/stub-provider.ts` — implement `StubVerificationProvider` that always returns `{ status: 'unverified', reason: 'No verification vendor configured.' }`
  - The interface is the extension point; the stub is the production implementation until a real vendor is integrated
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 10. Settings service (`/lib/settings/settings-service.ts`)
  - `updatePrivacySettings(userId, settings)`: validates input, updates `profile_visibility`, `dm_permissions`, `location_sharing` on the profile row using the service-role client
  - `blockUser(blockerId, blockedId)`: inserts into `blocks` table; validates that `blockerId !== blockedId`
  - `unblockUser(blockerId, blockedId)`: deletes matching row from `blocks`
  - `deleteAccount(userId)`: orchestrates deletion in order — (a) anonymise/delete user content, (b) soft-delete profile (set `deleted_at`), (c) revoke unredeemed invites via `InviteService.revokeUnredeemedByUser`, (d) call `supabase.auth.admin.deleteUser`. Log structured failure without PII and enqueue retry on partial failure.
  - _Requirements: 7.2, 7.3, 7.5, 7.6, 7.7_

- [ ] 11. Checkpoint — verify all lib modules compile and unit tests pass
  - Ensure all Vitest tests in `/tests/unit/` pass with no TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. RLS integration tests (`/tests/unit/rls.test.ts`)
  - [ ] 12.1 Write integration tests for RLS — Property 12: own-row isolation for authenticated users
    - **Property 12: RLS enforces own-row isolation for authenticated users**
    - **Validates: Requirements 5.2, 5.3, 5.5**
    - Use two test users with separate Supabase clients connected to the local emulator; assert user A cannot SELECT or UPDATE user B's `profiles`, `consents`, or `invites` rows
    - Tag: `// Feature: foundation-auth, Property 12`

  - [ ] 12.2 Write integration tests for RLS — Property 13: unauthenticated access denied
    - **Property 13: RLS denies all unauthenticated access to protected tables**
    - **Validates: Requirements 5.7**
    - Use an unauthenticated Supabase client; assert that SELECT on `profiles`, `invites`, `consents`, and `blocks` returns no rows and writes return permission errors
    - Tag: `// Feature: foundation-auth, Property 13`

  - [ ] 12.3 Write unit tests for RLS — direct client insert into consents is rejected
    - Assert that an authenticated client attempting to INSERT directly into `consents` receives a Postgres permission error (Requirement 5.4)
    - Assert that an authenticated client attempting to INSERT or UPDATE `invites` directly receives a permission error (Requirement 5.6)
    - _Requirements: 5.4, 5.6_

- [ ] 13. Tailwind config and DivaCrew theme (`tailwind.config.ts`)
  - Extend Tailwind with the DivaCrew color tokens: `cream`, `surface`, `charcoal`, `blush`, `terracotta`, `terracotta-light`, `forest`, `text-secondary`, `border`
  - Add `darkMode: 'class'` configuration
  - Add font families: `serif` (Playfair Display, DM Serif Display) and `sans` (Inter, DM Sans)
  - Add border-radius tokens: `card` (20px), `card-lg` (24px), `pill` (50px)
  - Configure `content` glob to include all `app/`, `components/`, and `lib/` files
  - _Requirements: 6.3_

- [ ] 14. Shared UI components (`/components/ui/`)
  - [ ] 14.1 Implement `ThemeProvider` (`/components/ui/theme-provider.tsx`)
    - On mount: read `localStorage.getItem('diva-theme')`; fall back to `window.matchMedia('(prefers-color-scheme: dark)')`
    - Listen for `matchMedia` change events; update only when no manual override is stored
    - Toggle `dark` class on `<html>` element
    - Expose `setTheme(theme: 'light' | 'dark')` that writes to `localStorage` and updates immediately
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 14.2 Write property test for theme — Property 14: theme preference persists across sessions
    - **Property 14: Theme preference persists across sessions**
    - **Validates: Requirements 6.5**
    - Mock `localStorage`; generate arbitrary theme values; assert that after `setTheme(v)` a simulated remount reads back the same `v`
    - Tag: `// Feature: foundation-auth, Property 14`

  - [ ] 14.3 Implement `BottomNav` (`/components/ui/bottom-nav.tsx`)
    - Render a `<nav role="navigation" aria-label="Main navigation">` with five `<button>` tabs: Feed, Crews, Fits, Check-in, Me
    - Active tab: terracotta icon (`#B94A3C`) + blush pill background (`#F9E8E3`); inactive tab: warm-grey icon (`#6B5F58`)
    - Each tab has `aria-label` and the active tab has `aria-current="page"`
    - Tab labels: 10–11px, Inter Medium; icons from Lucide (rounded)
    - Keyboard navigable via Tab key
    - Use Next.js `<Link>` for navigation — no full page reload
    - _Requirements: 6.1, 6.2, 6.7_

  - [ ] 14.4 Implement `Card` (`/components/ui/card.tsx`)
    - Accept `variant` prop: `'light'` (bg `#FAF5F0`), `'dark'` (bg `#1A1A1A`), `'blush'` (bg `#F9E8E3`)
    - Border radius `20px`, padding `20px`, subtle box-shadow
    - _Requirements: 6.3_

  - [ ] 14.5 Implement `PillButton` (`/components/ui/pill-button.tsx`)
    - Accept `variant` prop: `'primary'` (forest green bg) or `'secondary'` (outline)
    - Full-width, `border-radius: 50px`, height `52px`, white text for primary
    - Disabled state handled; accessible with correct `aria-disabled`
    - _Requirements: 6.3, 6.6_

  - [ ] 14.6 Implement `SectionHeader` (`/components/ui/section-header.tsx`)
    - Render small uppercase terracotta label + large Playfair Display bold heading below
    - Accept `label` and `heading` props
    - _Requirements: 6.3_

  - [ ] 14.7 Implement `PrivacyBadge` (`/components/ui/privacy-badge.tsx`)
    - Small pill with translucent background, green lock icon, "private by design" text
    - _Requirements: 3.8_

- [ ] 15. Auth pages and components (`/app/(auth)/`, `/components/auth/`)
  - [ ] 15.1 Build auth layout (`/app/(auth)/layout.tsx`)
    - Unauthenticated shell: no BottomNav, cream background, centred content column, max-width mobile
    - _Requirements: 1.1_

  - [ ] 15.2 Build `PhoneInput` component (`/components/auth/phone-input.tsx`)
    - E.164 phone entry with country code picker (default +91 India)
    - Client-side validation using `PhoneSchema` on submit
    - Shows rate-limit error with wait time when `resetAt` is returned from server action
    - _Requirements: 1.1, 1.3_

  - [ ] 15.3 Build phone page (`/app/(auth)/phone/page.tsx`)
    - Renders `SectionHeader` with label "JOIN DIVACREW" and headline "What's your number, girl?"
    - Renders `PhoneInput`; on submit calls `sendOtp` server action
    - On success redirects to `/verify`
    - _Requirements: 1.1_

  - [ ] 15.4 Build `OtpInput` component (`/components/auth/otp-input.tsx`)
    - 6-digit entry with individual character boxes, auto-advance on digit entry
    - Paste support; validates with `OtpTokenSchema`
    - Shows descriptive error on wrong/expired OTP without revealing phone existence
    - _Requirements: 1.4, 1.5, 1.6_

  - [ ] 15.5 Build verify page (`/app/(auth)/verify/page.tsx`)
    - Renders `OtpInput`; calls `verifyOtp` server action
    - On success redirects to `/invite`
    - "Resend code" link respects rate limiter state
    - _Requirements: 1.4, 1.5, 1.6_

  - [ ] 15.6 Build `InviteCodeInput` component (`/components/auth/invite-code-input.tsx`)
    - Alphanumeric input, uppercases automatically, validates with `InviteCodeSchema`
    - Shows specific error messages for invalid/expired/redeemed codes
    - Shows rate-limit error after 5 invalid attempts
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

  - [ ] 15.7 Build invite page (`/app/(auth)/invite/page.tsx`)
    - Renders `InviteCodeInput`; calls `redeemInvite` server action (wraps `InviteService.validateAndRedeem`)
    - On success redirects to `/onboarding/nickname`
    - _Requirements: 2.1, 2.3_

- [ ] 16. Onboarding pages and components (`/app/(onboarding)/`, `/components/onboarding/`)
  - [ ] 16.1 Build onboarding layout (`/app/(onboarding)/layout.tsx`)
    - Cream background, step progress indicator ("1 of 5"), no BottomNav
    - _Requirements: 3.1_

  - [ ] 16.2 Build `NicknameStep` component and page
    - Component (`/components/onboarding/nickname-step.tsx`): text input with `NicknameSchema` client-side validation
    - Page (`/app/(onboarding)/nickname/page.tsx`): `SectionHeader` label "GETTING STARTED", headline "What do your girls call you?", `PillButton` "Continue"
    - On submit validates and advances to `/onboarding/avatar`
    - _Requirements: 3.1, 3.2_

  - [ ] 16.3 Build `AvatarStep` component and page
    - Component (`/components/onboarding/avatar-step.tsx`): grid of ≥6 preset avatar options + "Upload your own" option
    - Upload validates MIME type and size with `AvatarUploadSchema`; uploads to Supabase Storage `avatars` bucket on selection
    - Page (`/app/(onboarding)/avatar/page.tsx`): headline "Pick your vibe.", `PillButton` "Looks good"
    - _Requirements: 3.1, 3.3, 3.4_

  - [ ] 16.4 Build `CityStep` component and page
    - Component (`/components/onboarding/city-step.tsx`): text input for city name
    - Page (`/app/(onboarding)/city/page.tsx`): headline "Where are you based?", `PillButton` "Next"
    - _Requirements: 3.1_

  - [ ] 16.5 Build `DobStep` component and page
    - Component (`/components/onboarding/dob-step.tsx`): date picker that collects DOB; validates with `DobSchema`
    - Client shows generic "DivaCrew is for girls 16 and up." error when server returns `AGE_TOO_YOUNG`
    - DOB is sent to server action only — never stored in client state beyond the form field
    - Page (`/app/(onboarding)/dob/page.tsx`): headline "Just checking in — how old are you?", note: "We won't store your exact date."
    - _Requirements: 3.1, 3.5, 3.6_

  - [ ] 16.6 Build `ConsentStep` component and page
    - Component (`/components/onboarding/consent-step.tsx`): plain-language privacy notice in English (Hindi optional), summarising data collection, usage, deletion rights, and women-only notice. `PrivacyBadge` included.
    - For minors: renders blush `#F9E8E3` banner with DPDP guardian awareness notice
    - "I Agree" button calls `recordConsent` server action; "Exit" navigates back to sign-up entry
    - Page (`/app/(onboarding)/consent/page.tsx`): headline "Before you join the crew…", `PillButton` "I Agree"
    - _Requirements: 3.1, 3.8, 3.9, 3.10, 3.11_

  - [ ] 16.7 Wire onboarding server action (`/lib/onboarding/onboarding-actions.ts`)
    - `submitOnboarding(data)`: calls `OnboardingService.createProfile` then `OnboardingService.recordConsent`; on success redirects to `/(app)/feed`
    - Mark with `'use server'`
    - _Requirements: 3.1, 3.6, 3.7, 3.9_

- [ ] 17. Checkpoint — verify auth and onboarding flows render correctly
  - Confirm all TypeScript errors are resolved in auth and onboarding files
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. App shell and authenticated layout (`/app/(app)/`)
  - [ ] 18.1 Build authenticated layout (`/app/(app)/layout.tsx`)
    - Server component that checks session via Supabase server client; redirects to `/phone` if unauthenticated
    - Renders `ThemeProvider` wrapping children + `BottomNav` fixed at bottom
    - _Requirements: 6.1, 6.3_

  - [ ] 18.2 Create placeholder pages for Feed, Crews, Fits, Check-in, Me
    - `/app/(app)/feed/page.tsx`, `crews/page.tsx`, `fits/page.tsx`, `checkin/page.tsx`, `me/page.tsx`
    - Each renders a `SectionHeader` with its tab name and a `Card` with placeholder copy — enough to validate BottomNav routing
    - _Requirements: 6.1, 6.2_

- [ ] 19. Settings screens and components (`/app/(app)/settings/`, `/components/settings/`)
  - [ ] 19.1 Build settings root screen (`/app/(app)/settings/page.tsx`, `/components/settings/settings-screen.tsx`)
    - Three `Card` sections: Privacy Settings, Block List, Delete My Account
    - Accessible from the Me tab
    - _Requirements: 7.1_

  - [ ] 19.2 Build privacy settings page (`/app/(app)/settings/privacy/page.tsx`)
    - Toggle for profile visibility (public/private), DM permissions (everyone/connections/nobody), location sharing
    - On change calls `updatePrivacySettings` server action (wraps `SettingsService.updatePrivacySettings`)
    - _Requirements: 7.1, 7.2_

  - [ ] 19.3 Build block list page and component (`/app/(app)/settings/blocks/page.tsx`, `/components/settings/block-list.tsx`)
    - Scrollable list of blocked users; each row has an "Unblock" button
    - Calls `blockUser` / `unblockUser` server actions
    - _Requirements: 7.1, 7.3_

  - [ ] 19.4 Build delete account page and component (`/app/(app)/settings/delete/page.tsx`, `/components/settings/delete-account.tsx`)
    - Confirmation screen listing what will be deleted with an irreversibility warning
    - Two-step: "Delete My Account" button → confirmation prompt → `deleteAccount` server action
    - On completion: sign out and redirect to `/phone`
    - On partial failure: displays "Something went wrong… your request has been saved and will complete shortly."
    - _Requirements: 7.4, 7.5, 7.6, 7.7_

  - [ ]* 19.5 Write property tests for settings — Property 15: privacy settings are immediately reflected
    - **Property 15: Privacy setting updates are immediately reflected**
    - **Validates: Requirements 7.2**
    - Use `fast-check` to generate valid `(field, value)` pairs; mock the DB; assert that `updatePrivacySettings` followed by a profile read returns the updated value
    - Tag: `// Feature: foundation-auth, Property 15`

  - [ ]* 19.6 Write property tests for settings — Property 16: blocking excludes user content from all surfaces
    - **Property 16: Blocking a user excludes their content from all surfaces**
    - **Validates: Requirements 7.3**
    - Assert that after `blockUser(A, B)`, a query for B's profile from A's session returns no results, and B's posts are absent from A's feed query
    - Tag: `// Feature: foundation-auth, Property 16`

  - [ ]* 19.7 Write property tests for settings — Property 17: account deletion clears all user data
    - **Property 17: Account deletion clears all user data completely**
    - **Validates: Requirements 7.5, 7.7**
    - Assert that `deleteAccount` calls all four deletion sub-steps; assert partial failure is logged without PII and queued for retry
    - Tag: `// Feature: foundation-auth, Property 17`

- [ ] 20. Unit tests for rate limiter and invite service (example-based, Requirement 8 and 9)
  - Write example-based Vitest tests in `/tests/unit/rate-limiter.test.ts`:
    - After 3 OTP sends in 10 min, the 4th returns a rate-limit error (Requirement 8.1)
    - After the window elapses, requests are accepted again (Requirement 8.2)
    - Counter is scoped per phone number (Requirement 8.3)
  - Write example-based Vitest tests in `/tests/unit/invite-service.test.ts`:
    - Valid unredeemed code is accepted; `inviter_id` and `redeemed_by` are recorded correctly (Requirement 9.1)
    - _Requirements: 8.1, 8.2, 8.3, 9.1_

- [ ] 21. E2E tests (`/tests/e2e/`)
  - [ ]* 21.1 Write Playwright OTP flow test (`/tests/e2e/otp-flow.spec.ts`)
    - Navigate to `/phone`, submit a phone number 3 times, assert the 4th attempt shows the rate-limit error message with the correct wait time
    - Integrate `axe-core` accessibility check on the phone and verify pages
    - _Requirements: 8.4_

  - [ ]* 21.2 Write Playwright invite flow test (`/tests/e2e/invite-flow.spec.ts`)
    - Mock a verified OTP session, navigate to `/invite`, enter an invalid code, assert error message shown; then enter a valid code, assert navigation to onboarding
    - Integrate `axe-core` accessibility check on the invite page
    - _Requirements: 9.6_

- [ ] 22. Final checkpoint — full test suite and accessibility audit
  - Run `vitest --run` and confirm all unit and property tests pass
  - Run `playwright test` and confirm both E2E specs pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but all 17 correctness properties should be covered before production
- The critical ordering rule is enforced by the task sequence: migrations (2) → RLS (3) → lib services (5–10) → UI components (13–14) → pages (15–19) → tests (20–22)
- Property tests use `fast-check` with `{ numRuns: 100 }` minimum per property
- Each property test file carries a tag comment: `// Feature: foundation-auth, Property N`
- The DOB is a transient server-side input only — it must never appear in any database column, log, or client state beyond the form field lifetime
- The `StubVerificationProvider` is the production implementation until a real liveness vendor is integrated; the `VerificationProvider` interface is the integration seam
- Environment secrets must only be read from env vars — never hardcoded or logged
