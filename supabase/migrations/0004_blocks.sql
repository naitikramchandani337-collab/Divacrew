-- Migration: 0004_blocks.sql
-- Creates the blocks table for user-level content blocking.
-- Enforces uniqueness per (blocker, blocked) pair and prevents self-blocking.

CREATE TABLE blocks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked_id ON blocks(blocked_id);
