-- Migration: 0002_invites.sql
-- Creates the invites table for invite-only access control with inviter tracking.
-- Codes expire 30 days after issuance.

CREATE TABLE invites (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text        NOT NULL UNIQUE,
  owner_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redeemed_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  redeemed_at  timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_code        ON invites(code);
CREATE INDEX idx_invites_owner_id    ON invites(owner_id);
CREATE INDEX idx_invites_redeemed_by ON invites(redeemed_by);
