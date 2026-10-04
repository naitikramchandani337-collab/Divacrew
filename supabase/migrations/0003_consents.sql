-- Migration: 0003_consents.sql
-- Creates the consents table for DPDP Act compliance.
-- Rows are inserted only via the record_consent SECURITY DEFINER function —
-- never via a direct client INSERT.

CREATE TABLE consents (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  privacy_notice_version text        NOT NULL,   -- e.g. "v1.0"
  age_bracket            text        NOT NULL CHECK (age_bracket IN ('minor', 'adult')),
  accepted_at            timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consents_user_id ON consents(user_id);
