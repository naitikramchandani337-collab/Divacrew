-- Migration: 0001_profiles.sql
-- Creates the profiles table with all columns, CHECK constraints, defaults, and indexes.
-- NOTE: Exact date of birth is NEVER stored. age_bracket is the only age-related column.

CREATE TABLE profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname            text        NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 30),
  avatar_url          text,
  city                text,
  age_bracket         text        NOT NULL CHECK (age_bracket IN ('minor', 'adult')),
  -- verification
  verification_status text        NOT NULL DEFAULT 'unverified'
                                  CHECK (verification_status IN ('unverified', 'pending', 'verified')),
  -- privacy settings
  profile_visibility  text        NOT NULL DEFAULT 'public'
                                  CHECK (profile_visibility IN ('public', 'private')),
  dm_permissions      text        NOT NULL DEFAULT 'connections'
                                  CHECK (dm_permissions IN ('everyone', 'connections', 'nobody')),
  location_sharing    boolean     NOT NULL DEFAULT false,
  -- invite tracking
  inviter_id          uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  -- soft delete
  deleted_at          timestamptz,
  -- audit
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_inviter_id          ON profiles(inviter_id);
CREATE INDEX idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX idx_profiles_deleted_at          ON profiles(deleted_at) WHERE deleted_at IS NULL;
