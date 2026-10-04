# Requirements Document

## Introduction

The SOS Alert feature gives DivaCrew users a high-urgency emergency signal tool that is distinct from, and more intense than, the existing 🔴 Need Help check-in status. When a user activates SOS, three things happen simultaneously: the phone dialer opens pre-filled with 112 (the user must tap Call once — this is a hard browser security constraint in PWA/web environments that cannot be bypassed), a high-priority push notification alarm is blasted to every trusted contact in her crew-checkin contact list, and her own device begins sounding an alarm tone with continuous vibration.

DivaCrew is a Next.js PWA. Auto-dialling is **not** technically possible in any browser-based app; the best available mechanism is a `tel:112` link that opens the native dialler pre-filled. This limitation is documented honestly in the UI and in this spec. The feature never claims to contact emergency services automatically.

This spec builds on:
- **foundation-auth**: `profiles`, `verification_status`, push notification infrastructure (`Notification_Service`).
- **crew-checkin**: `trusted_contacts` table (shared data source for SOS recipients), `checkin_sessions` (source of `coarse_area` at trigger time), `Notification_Service`.
- **moderation**: `Audit_Service` pattern for staff-access audit logging.

The SOS button is a separate feature from the 🔴 Need Help check-in status. SOS is louder, more urgent, and designed for immediate perceived danger — not a status update.

---

## Glossary

- **App**: The DivaCrew Next.js PWA.
- **SOS_Service**: The server-side component in `/lib/sos` responsible for creating SOS sessions, dispatching push notifications to trusted contacts, and managing session lifecycle.
- **Notification_Service**: The shared server-side component (defined in foundation-auth / crew-checkin) that sends Web Push API notifications to registered devices.
- **SOS_Button**: The UI element that a user activates to trigger an SOS alert — available as a persistent floating button in the app shell and within the Check-in tab.
- **SOS_Session**: A row in the `sos_sessions` table representing a single SOS activation event, from trigger through resolution or cancellation.
- **Activation_Gesture**: The deliberate gesture required to fire the SOS — either a 3-second hold or three rapid presses — chosen by the user in Settings.
- **Cancellation_Window**: The 10-second period immediately after activation during which the user can abort the SOS before notifications are dispatched to contacts.
- **Trusted_Contact**: A DivaCrew member who has accepted a contact request from the SOS sender, as recorded in the `trusted_contacts` table (crew-checkin spec).
- **Coarse_Area**: The short human-typed area name copied from the user's active `checkin_session` at the moment of SOS trigger, if one exists. Never GPS coordinates.
- **Alarm_Notification**: The Web Push notification dispatched to a Trusted_Contact's device with urgency `high`, a distinct alarm tone, and persistent display until the contact actively dismisses it.
- **Acknowledgement**: An action taken by a Trusted_Contact (tapping "I'm checking on her") recorded in the SOS session's `contact_acknowledgements` array.
- **SOS_Data_Deleter**: A scheduled job that hard-deletes `sos_sessions` rows older than 30 days.
- **Profile**: A row in the `profiles` table as defined in foundation-auth.
- **Minor**: A user whose `age_bracket` is `minor` (under 18) as defined in foundation-auth.
- **PWA_Limitation**: A documented browser-security constraint that prevents any web application from programmatically initiating a phone call without explicit user tap confirmation.

---

## Requirements

### Requirement 1: SOS Button — Placement and Visibility

**User Story:** As a user, I want an SOS button that is always accessible from the app, so that I can trigger an alert quickly when I feel I am in danger.

#### Acceptance Criteria

1. THE App SHALL display a persistent floating SOS button in the app shell, visible on every authenticated screen, when the user has enabled "Show floating SOS button" in Settings.
2. THE App SHALL display an SOS button within the Check-in tab regardless of the floating button setting, so that all users have access to SOS from at least one surface.
3. WHILE the floating SOS button is enabled, THE App SHALL render it as a persistent overlay element above all other content, with a minimum touch target of 44 × 44 px, positioned so that it does not obscure primary navigation controls.
4. THE App SHALL display the floating SOS button only to authenticated users; unauthenticated users SHALL NOT see it.
5. WHEN a user disables "Show floating SOS button" in Settings, THE App SHALL hide the floating button immediately without requiring an app restart.
6. THE SOS_Button SHALL be keyboard navigable and have an accessible label: "Activate SOS alert".
7. THE App SHALL visually distinguish the SOS button from all other interactive elements using a high-contrast red colour and the label "SOS", meeting WCAG 2.1 AA contrast ratios in both light and dark themes.

---

### Requirement 2: Activation Gesture — Deliberate Trigger Prevention

**User Story:** As a user, I want the SOS button to require a deliberate gesture to activate, so that I do not accidentally trigger a false alarm while using the app normally.

#### Acceptance Criteria

1. THE App SHALL support exactly two Activation_Gestures: (a) hold the SOS button for 3 continuous seconds, or (b) press the SOS button three times rapidly within 1.5 seconds.
2. WHEN a user begins the hold gesture, THE App SHALL display a circular countdown animation filling over 3 seconds so the user can see how much longer to hold.
3. WHEN a user begins the hold gesture and releases before 3 seconds have elapsed, THE App SHALL cancel the activation and reset the countdown UI to its idle state.
4. WHEN a user presses the SOS button twice (during a triple-press attempt) without completing the third press within 1.5 seconds, THE App SHALL reset the press counter and briefly show a visual cue: "Press 3× to activate SOS".
5. WHEN the Activation_Gesture is completed, THE App SHALL immediately show the SOS active state before the Cancellation_Window begins — the gesture completion is the moment of activation.
6. THE App SHALL allow a user to choose their preferred Activation_Gesture (hold or triple-press) in Settings; the default SHALL be the 3-second hold.
7. THE App SHALL display the chosen Activation_Gesture method as a tooltip or label near the SOS button: "Hold 3 s to activate" or "Press 3× to activate", so the user always knows how to trigger it.

---

### Requirement 3: Cancellation Window — Accidental Trigger Protection

**User Story:** As a user, I want a 10-second window to cancel an SOS I accidentally triggered, so that I do not cause a false alarm that worries my contacts.

#### Acceptance Criteria

1. WHEN an Activation_Gesture completes, THE App SHALL immediately display a full-screen "SOS Activating…" overlay showing a 10-second countdown before dispatching any push notifications to Trusted_Contacts.
2. WHILE the Cancellation_Window countdown is running, THE App SHALL display a prominent "Cancel SOS" button that the user can tap to abort the alert.
3. WHEN a user taps "Cancel SOS" within the Cancellation_Window, THE SOS_Service SHALL record `cancelled_at` on the SOS_Session, stop the countdown, dismiss the overlay, and NOT dispatch any push notifications to Trusted_Contacts.
4. WHEN a user taps "Cancel SOS" within the Cancellation_Window, THE App SHALL NOT sound the alarm on the activating user's device (the alarm starts only after the window expires).
5. WHEN the Cancellation_Window countdown reaches zero without cancellation, THE SOS_Service SHALL simultaneously: (a) dispatch Alarm_Notifications to all Trusted_Contacts, (b) start the continuous alarm tone and vibration on the activating user's device using the Web Audio API and Web Vibration API, and (c) record the `contacts_notified_count` on the SOS_Session.
6. AFTER the Cancellation_Window has expired, THE App SHALL NOT offer a "Cancel SOS" option; only the "I'm okay now" resolution path shall be available.
7. THE App SHALL display the legal disclaimer on the Cancellation_Window overlay in plain text: "This opens the emergency dialler. It does not contact police automatically. Call 112 yourself."
8. WHEN the Cancellation_Window countdown begins, THE App SHALL immediately open the phone dialler pre-filled with 112 via a `tel:112` link, regardless of whether the user cancels within the window or not.

---

### Requirement 4: SOS Activation — What Happens When SOS Fires

**User Story:** As a user who has activated SOS, I want my contacts to be immediately alerted and my device to make noise, so that people around me and my trusted contacts know I need help.

#### Acceptance Criteria

1. WHEN the Cancellation_Window expires without cancellation, THE SOS_Service SHALL dispatch an Alarm_Notification to every active Trusted_Contact of the activating user, retrieved from the `trusted_contacts` table using the same contact list as crew-checkin.
2. THE Alarm_Notification payload SHALL contain: the Web Push `urgency` header set to `"high"`, a `topic` header set to `"sos-alert"` (so that repeated SOS alerts replace rather than stack), the notification title `"🚨 [Nickname] needs help — check on her"`, the `coarse_area` from the user's active `checkin_session` if one exists (nullable), and the timestamp of activation.
3. THE Alarm_Notification SHALL be configured to use the Android notification channel with `IMPORTANCE_HIGH`, sound, and vibration pattern on Android PWA clients, so that it is not silenced by standard Do Not Disturb settings where the platform permits.
4. THE Alarm_Notification on iOS PWA clients SHALL use the best available priority mechanism; THE App SHALL document in code that iOS PWA cannot deliver true critical alerts (which require a native app) and that this is a known, disclosed limitation.
5. WHEN SOS is active, THE App SHALL play a continuous alarm tone on the activating user's device using the Web Audio API, and trigger a repeating vibration pattern using the Web Vibration API, until the user taps "I'm okay now" or the device browser tab is closed.
6. THE App SHALL display a prominent full-screen SOS active UI on the activating user's device showing: (a) a large "CALL 112" button rendered as a `tel:112` link with accessible label "Call emergency services — 112", (b) the disclaimer "This is a community alert tool, not a replacement for emergency services (112).", (c) the number of contacts notified, (d) an "I'm okay now" button to resolve the session, and (e) the elapsed time since activation.
7. THE SOS_Service SHALL create a `sos_sessions` row upon Activation_Gesture completion (before the Cancellation_Window begins), recording: `id`, `user_id`, `started_at`, `cancelled_at` (null), `resolved_at` (null), `coarse_area_at_trigger` (copied from active checkin session if exists, null otherwise), `contacts_notified_count` (0 until window expires), `contact_acknowledgements` (empty array).
8. IF the activating user has no active Trusted_Contacts, THE App SHALL still open the dialler, still sound the alarm on the activating user's device, and display a message: "You have no trusted contacts yet. Call 112 in an emergency."
9. THE App SHALL NOT claim at any point that the SOS has automatically contacted police, emergency services, or any authority.

---

### Requirement 5: Contact Alarm Notification — Recipient Experience

**User Story:** As a trusted contact who receives an SOS alarm, I want my phone to sound an alarm even if it is on silent, and I want to be able to see the alert and indicate that I am responding.

#### Acceptance Criteria

1. WHEN a Trusted_Contact's device receives an Alarm_Notification, THE App SHALL display it as a persistent notification that does not auto-dismiss; the contact SHALL be required to actively tap or dismiss it.
2. THE Alarm_Notification displayed on the contact's device SHALL contain: the sender's nickname, the coarse area if provided, the time of the alert, and an action button labelled "I'm checking on her".
3. WHEN a Trusted_Contact taps the Alarm_Notification or opens DivaCrew from it, THE App SHALL navigate them to a screen showing the active SOS session: the sender's nickname, the coarse area if available, time elapsed, and the "I'm checking on her" button.
4. WHEN a Trusted_Contact taps "I'm checking on her", THE SOS_Service SHALL append that contact's `user_id` to the `contact_acknowledgements` array on the SOS_Session and update the activating user's SOS active screen to reflect the acknowledgement count.
5. THE App SHALL display a disclaimer on the SOS session screen visible to Trusted_Contacts: "This is a community alert tool, not a replacement for emergency services (112)."
6. THE App SHALL display a "Call 112" button rendered as a `tel:112` link on the SOS session screen visible to Trusted_Contacts, in case the contact also wants to call emergency services.
7. WHILE a SOS_Session's `resolved_at` and `cancelled_at` are both null, THE App SHALL allow Trusted_Contacts to view the session and acknowledge it.
8. WHEN the SOS_Session is resolved (the sender taps "I'm okay now"), THE Notification_Service SHALL dispatch a follow-up push notification to all Trusted_Contacts who were notified, with the message: "[Nickname] has marked herself okay." — the word "safe" SHALL NOT appear in this message.

---

### Requirement 6: SOS Resolution

**User Story:** As a user whose SOS is active, I want to be able to mark myself as okay and stop the alarm, so that my contacts know the situation has resolved and my device stops making noise.

#### Acceptance Criteria

1. WHEN a user taps "I'm okay now" on the SOS active screen, THE SOS_Service SHALL: (a) set `resolved_at` on the SOS_Session to the current timestamp, (b) stop the alarm tone and vibration on the activating user's device, (c) dispatch a resolution push notification to all Trusted_Contacts who received the original Alarm_Notification.
2. THE resolution notification payload SHALL read: "[Nickname] has marked herself okay." — the word "safe" SHALL NOT appear.
3. AFTER resolution, THE App SHALL display a confirmation screen to the user with: the message "Situation resolved", the count of contacts who acknowledged ("X contacts checked in on you"), and a prominent "Call 112" button.
4. THE "I'm okay now" button label SHALL NOT contain the word "safe"; it SHALL read "I'm okay now" or "Situation resolved".
5. THE App SHALL NOT prevent the user from re-activating SOS after a prior session has resolved; each activation is an independent SOS_Session.
6. WHEN the SOS active UI is visible and the browser tab is brought to the foreground, THE App SHALL resume the alarm tone if it was interrupted by a browser audio policy.
7. IF the activating user's device loses internet connectivity while SOS is active, THE App SHALL continue sounding the alarm locally (device-side audio and vibration do not require network) and SHALL display a connectivity warning: "No connection — alarm sounding locally. Reconnect to update your contacts."

---

### Requirement 7: Safety Copy Rules — Mandatory Language Constraints

**User Story:** As a product owner, I want all SOS-related UI copy to follow strict language rules, so that the app never misleads users about what the feature does or implies a false sense of security.

#### Acceptance Criteria

1. THE App SHALL NEVER display any copy claiming or implying that the SOS feature contacts emergency services, police, or any authority automatically.
2. THE App SHALL display the disclaimer "This is a community alert tool, not a replacement for emergency services (112)." on every SOS-related screen: the SOS active screen, the Cancellation_Window overlay, the contact acknowledgement screen, and the post-resolution screen.
3. THE App SHALL display a prominent "Call 112" button rendered as a `tel:112` link on every SOS-related screen.
4. THE App SHALL NEVER use the word "safe" in any SOS-related UI copy — including button labels, notification text, confirmation messages, and settings descriptions.
5. THE App SHALL display the following disclaimer at the point of activation (on the Cancellation_Window overlay): "This opens the emergency dialler. It does not contact police automatically. Call 112 yourself."
6. THE App SHALL display the resolution screen message using the word "okay" or the phrase "Situation resolved" — NOT the word "safe".
7. WHEN the SOS feature is described in Settings (floating button toggle, activation gesture selector), THE App SHALL include a one-line description: "SOS sends a community alert to your trusted contacts. It does not contact emergency services. Always call 112 in an emergency."

---

### Requirement 8: SOS Session Data Storage and RLS

**User Story:** As a product owner, I want SOS session data stored in a dedicated table with strict RLS and automatic deletion, so that sensitive distress data is protected and does not accumulate indefinitely.

#### Acceptance Criteria

1. THE App SHALL store SOS data in a dedicated `sos_sessions` table with columns: `id` (UUID, PK), `user_id` (FK → profiles), `started_at` (timestamptz), `cancelled_at` (timestamptz, nullable), `resolved_at` (timestamptz, nullable), `coarse_area_at_trigger` (text, nullable), `contacts_notified_count` (integer), `contact_acknowledgements` (UUID array, default empty), `created_at` (timestamptz), `updated_at` (timestamptz).
2. THE App SHALL enable Row Level Security on the `sos_sessions` table.
3. WHILE a user is authenticated, THE App SHALL allow that user to read and update only their own rows in `sos_sessions` (where `user_id` = their user ID).
4. WHILE a user is authenticated, THE App SHALL allow an active Trusted_Contact of the session owner to read (but not update) that session's row in `sos_sessions`, enforced at the database layer via RLS.
5. THE App SHALL NOT allow any staff or moderator to read `sos_sessions` rows without an Audit_Service log entry recording: `staff_id` (hashed), `action` (`staff_read`), `target_id` (hashed session ID), `table_name`, `accessed_at`, and `reason`.
6. THE App SHALL NEVER store exact GPS coordinates, device location signals, or IP-derived location in `sos_sessions`; only the `coarse_area_at_trigger` field (copied from checkin session) is permitted.
7. THE SOS_Data_Deleter SHALL run on a scheduled basis at a minimum interval of every 60 minutes and SHALL hard-delete all rows in `sos_sessions` where `created_at + 30 days ≤ now`.
8. THE App SHALL NOT allow any client to insert directly into `sos_sessions`; all inserts SHALL be performed via a trusted server-side function using the service role.
9. THE App SHALL NOT allow any client to update the `contact_acknowledgements` array directly; all updates SHALL be performed via a trusted server-side function with the service role.
10. THE App SHALL deny all access to `sos_sessions` for unauthenticated requests.

---

### Requirement 9: SOS Settings

**User Story:** As a user, I want to configure my SOS preferences, so that the button appears where I want it and behaves how I expect it to.

#### Acceptance Criteria

1. THE App SHALL provide an "SOS Alert" section in Settings containing: a toggle "Show floating SOS button" (default: off), an "Activation gesture" selector (Hold 3 s / Triple-press, default: Hold 3 s), and a toggle "Include my current area in SOS alert" (default: on if a check-in session is active, off otherwise).
2. WHEN a user toggles "Show floating SOS button", THE App SHALL immediately show or hide the floating SOS button in the app shell without requiring a page reload.
3. WHEN a user selects an Activation_Gesture in Settings, THE SOS_Service SHALL apply that gesture globally for all subsequent SOS activations on that user's account.
4. WHEN "Include my current area in SOS alert" is disabled, THE SOS_Service SHALL set `coarse_area_at_trigger` to null on new SOS_Sessions even if an active checkin session with a coarse area exists.
5. THE Settings section for SOS SHALL display the one-line disclaimer: "SOS sends a community alert to your trusted contacts. It does not contact emergency services. Always call 112 in an emergency."
6. THE App SHALL display the SOS settings section only to authenticated users; it SHALL NOT be visible to unauthenticated users.

---

### Requirement 10: PWA Technical Limitations Documentation

**User Story:** As a developer, I want the spec to document the PWA limitations around auto-dialling and critical alerts, so that no future developer implements or promises behaviour that the browser platform cannot deliver.

#### Acceptance Criteria

1. THE App SHALL NEVER implement or claim auto-dialling behaviour; the emergency call mechanism SHALL exclusively use a `tel:112` link that opens the device's native dialler with 112 pre-filled, requiring one tap from the user to initiate the call.
2. THE implementation code for the SOS dialler trigger SHALL include an inline code comment: `// PWA limitation: browsers cannot auto-dial. tel:112 opens the native dialler pre-filled; the user must tap Call.`
3. THE App's iOS push notification implementation for SOS SHALL include an inline code comment: `// iOS PWA limitation: critical alerts that override silent mode require a native app entitlement (com.apple.developer.usernotifications.critical-alerts). This PWA delivers best-effort high-priority notifications only.`
4. THE App SHALL use the Web Push API `urgency: "high"` header on all SOS Alarm_Notifications to signal to push services that delivery should be prioritised, on all supported platforms.
5. THE App SHALL use the Web Vibration API (`navigator.vibrate`) for device vibration and the Web Audio API for alarm tone generation; THE implementation SHALL gracefully degrade if either API is unavailable (silent failure with no crash, alarm tone omitted or vibration omitted individually).
6. WHERE the Web Audio API alarm tone cannot be started due to browser autoplay restrictions (the document has not received a user interaction), THE App SHALL display a visual SOS active indicator and attempt to start the audio on the next user interaction with the active SOS screen.

---

### Requirement 11: Automated Tests — SOS Activation and Contact Notification

**User Story:** As a developer, I want automated tests verifying that SOS activation correctly triggers contact notifications and that the cancellation window prevents premature dispatch, so that the safety-critical flow is continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when the Cancellation_Window expires without cancellation, the SOS_Service dispatches an Alarm_Notification to every active Trusted_Contact of the activating user and records the correct `contacts_notified_count` on the SOS_Session.
2. THE test suite SHALL include a Vitest unit test verifying: when a user cancels within the Cancellation_Window, the SOS_Service records `cancelled_at` on the SOS_Session and dispatches zero push notifications to Trusted_Contacts.
3. THE test suite SHALL include a Vitest unit test verifying: when the SOS_Service dispatches notifications, the Alarm_Notification payload contains `urgency: "high"`, `topic: "sos-alert"`, and the correct sender nickname.
4. THE test suite SHALL include a Vitest unit test verifying: when a Trusted_Contact taps "I'm checking on her", the SOS_Service appends that contact's `user_id` to `contact_acknowledgements` on the SOS_Session.
5. THE test suite SHALL include a Vitest unit test verifying: when "I'm okay now" is tapped, `resolved_at` is set on the SOS_Session and a resolution notification is dispatched to all previously notified contacts.
6. THE test suite SHALL include a Vitest unit test verifying: when the resolution notification is dispatched, its text does NOT contain the word "safe" (case-insensitive).
7. THE test suite SHALL include a round-trip property: FOR ALL valid SOS activations (any authenticated user with at least one Trusted_Contact), after the Cancellation_Window expires, the `contacts_notified_count` on the SOS_Session SHALL equal the number of active Trusted_Contacts in the `trusted_contacts` table for that user at the time of activation.

---

### Requirement 12: Automated Tests — RLS Isolation

**User Story:** As a developer, I want automated tests verifying that non-contacts cannot read SOS session data, so that the privacy guarantees of the RLS policies are continuously verified and regressions are caught.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when a user who is NOT a Trusted_Contact of the SOS session owner queries `sos_sessions` for that owner's session, the query returns zero rows.
2. THE test suite SHALL include a Vitest unit test verifying: when an unauthenticated client queries `sos_sessions`, the query returns zero rows or an authorisation error.
3. THE test suite SHALL include a Vitest unit test verifying: when an authenticated Trusted_Contact of the session owner queries `sos_sessions`, the query returns the owner's active session row.
4. THE test suite SHALL include a Vitest unit test verifying: when a Trusted_Contact relationship is removed (soft-deleted via `removed_at` on `trusted_contacts`), the former contact can no longer read the owner's `sos_sessions` rows.
5. THE test suite SHALL include a round-trip property: FOR ALL SOS_Sessions created by any authenticated user, a query by that same user SHALL return the session with `user_id`, `started_at`, `coarse_area_at_trigger`, and `contacts_notified_count` equal to the values recorded at creation time (round-trip: create session → query as owner → assert field equality).
6. THE test suite SHALL include a Vitest unit test verifying: a direct client-side insert into `sos_sessions` is rejected by RLS with an authorisation error.
7. THE test suite SHALL include a Playwright end-to-end test that signs in as a second user who is not a Trusted_Contact of the SOS session owner, navigates to the DivaCrew app, and confirms that no SOS session data belonging to another user is visible.

---

### Requirement 13: Automatic Data Deletion Tests

**User Story:** As a developer, I want automated tests for the SOS_Data_Deleter job, so that the 30-day retention policy is continuously verified.

#### Acceptance Criteria

1. THE test suite SHALL include a Vitest unit test verifying: when the SOS_Data_Deleter runs for a session with `created_at` more than 30 days ago, the session row no longer exists in `sos_sessions` after the job runs.
2. THE test suite SHALL include a Vitest unit test verifying: when the SOS_Data_Deleter runs for a session with `created_at` less than 30 days ago, the session row is unchanged.
3. THE test suite SHALL include a property-based test: FOR ALL SOS_Sessions in the database, after the SOS_Data_Deleter has run, a session row SHALL exist if and only if `created_at + 30 days > now` (invariant: the deletion threshold is respected for all rows simultaneously).
