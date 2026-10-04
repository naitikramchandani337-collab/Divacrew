-- Migration: 0005_contact_requests.sql
-- Creates the contact_requests table for connection/DM permission requests.
-- Enforces uniqueness per (requester, target) pair and prevents self-requests.

CREATE TABLE contact_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id),
  CHECK (requester_id <> target_id)
);

CREATE INDEX idx_contact_requests_requester_id ON contact_requests(requester_id);
CREATE INDEX idx_contact_requests_target_id    ON contact_requests(target_id);
