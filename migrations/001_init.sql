-- Earn It: points an adult earns toward goals they set for themselves.
--
-- A balance is never stored. It is always
--   entries + approved direct_claims + approved open_decisions + auto_awards
--   - allocations
-- so nothing here can drift from the history that produced it.
--
-- Who may touch which row is declared in manifest.json `row_policies`, not here.

-- One row per member: who verifies their points.
--   verifier_mode 'none'   -> they log points themselves (entries)
--                 'person' -> claims go to verifier_id only (direct_claims)
--                 'anyone' -> claims are open to everyone (open_claims)
CREATE TABLE IF NOT EXISTS app_earn_it__prefs (
  member_id     TEXT PRIMARY KEY,
  verifier_mode TEXT NOT NULL DEFAULT 'none',
  verifier_id   TEXT,
  updated_at    TEXT NOT NULL
);

-- Self-logged points. Private to the member who logged them.
CREATE TABLE IF NOT EXISTS app_earn_it__entries (
  id         TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL,
  points     INTEGER NOT NULL CHECK (points > 0),
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS app_earn_it__entries_member_idx
  ON app_earn_it__entries (member_id, created_at);

-- A claim sent to one named verifier. Visible to those two members only.
-- The claimant writes the claim; only the verifier writes the decision columns
-- (status, points_granted, decided_at), and a decided claim is frozen.
-- verifier_id cannot change after the claim is filed, so a claim a member
-- addressed to themselves stays recognisable (verifier_id = member_id) and the
-- app counts it as self-logged, never as verified.
CREATE TABLE IF NOT EXISTS app_earn_it__direct_claims (
  id               TEXT PRIMARY KEY,
  member_id        TEXT NOT NULL,
  verifier_id      TEXT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  points_requested INTEGER NOT NULL CHECK (points_requested > 0),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'denied')),
  points_granted   INTEGER CHECK (points_granted IS NULL OR points_granted >= 0),
  decided_at       TEXT,
  created_at       TEXT NOT NULL
);

-- party_scoped reads are `member_id = ? OR verifier_id = ?`, which SQLite can
-- only answer from two single-column indexes.
CREATE INDEX IF NOT EXISTS app_earn_it__direct_claims_member_idx
  ON app_earn_it__direct_claims (member_id);
CREATE INDEX IF NOT EXISTS app_earn_it__direct_claims_verifier_idx
  ON app_earn_it__direct_claims (verifier_id, status);

-- A claim open to everyone: the first member to respond decides it.
-- `visibility` is always 'everyone'; the column exists because the row policy
-- reads it.
CREATE TABLE IF NOT EXISTS app_earn_it__open_claims (
  id               TEXT PRIMARY KEY,
  member_id        TEXT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  points_requested INTEGER NOT NULL CHECK (points_requested > 0),
  visibility       TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility = 'everyone'),
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS app_earn_it__open_claims_member_idx
  ON app_earn_it__open_claims (member_id, created_at);

-- The decision on an open claim. `decided_by` is stamped by the hub, so who
-- decided cannot be forged, and UNIQUE (claim_id) makes the first decision the
-- only one. `member_id` copies the claimant so their approved points can be
-- summed without a join. A decision the claimant wrote on their own claim is
-- recognisable (decided_by = member_id) and the app shows it as self-logged.
-- Whoever made a decision may delete it, which takes the points back.
CREATE TABLE IF NOT EXISTS app_earn_it__open_decisions (
  id             TEXT PRIMARY KEY,
  claim_id       TEXT NOT NULL,
  member_id      TEXT NOT NULL,
  decided_by     TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('approved', 'denied')),
  points_granted INTEGER NOT NULL DEFAULT 0 CHECK (points_granted >= 0),
  decided_at     TEXT NOT NULL,
  UNIQUE (claim_id)
);

CREATE INDEX IF NOT EXISTS app_earn_it__open_decisions_member_idx
  ON app_earn_it__open_decisions (member_id, status);

-- What a member is saving toward. Private unless they share it.
CREATE TABLE IF NOT EXISTS app_earn_it__goals (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  visibility  TEXT NOT NULL DEFAULT 'private'
              CHECK (visibility IN ('private', 'everyone')),
  attained_at TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS app_earn_it__goals_member_idx
  ON app_earn_it__goals (member_id, created_at);

-- Points earmarked for a goal. Deleting a goal deletes its allocations
-- (manifest `delete_cascades`), which returns the points to the balance.
CREATE TABLE IF NOT EXISTS app_earn_it__allocations (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT NOT NULL,
  member_id  TEXT NOT NULL,
  points     INTEGER NOT NULL CHECK (points > 0),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS app_earn_it__allocations_goal_idx
  ON app_earn_it__allocations (goal_id);
CREATE INDEX IF NOT EXISTS app_earn_it__allocations_member_idx
  ON app_earn_it__allocations (member_id);

-- Points paid in by a household automation (a streak milestone, a finished
-- task). Written only by the hub; the dispatcher reads `source_event_id`
-- before it runs, so a retried event is not paid twice.
CREATE TABLE IF NOT EXISTS app_earn_it__auto_awards (
  id              TEXT PRIMARY KEY,
  member_id       TEXT NOT NULL,
  points          INTEGER NOT NULL CHECK (points > 0),
  note            TEXT NOT NULL DEFAULT '',
  source_event_id TEXT,
  awarded_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS app_earn_it__auto_awards_member_idx
  ON app_earn_it__auto_awards (member_id, awarded_at);
CREATE INDEX IF NOT EXISTS app_earn_it__auto_awards_event_idx
  ON app_earn_it__auto_awards (source_event_id);
