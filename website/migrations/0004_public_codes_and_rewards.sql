ALTER TABLE redeem_codes ADD COLUMN code_name TEXT NOT NULL DEFAULT '';
ALTER TABLE redeem_codes ADD COLUMN public_code TEXT;

UPDATE redeem_codes
SET code_name = code_hint,
    public_code = code_hint
WHERE secret = 0;

CREATE TABLE IF NOT EXISTS user_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_code_id TEXT,
  reward_type TEXT NOT NULL,
  reward_value TEXT,
  display_name TEXT NOT NULL,
  equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0, 1)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_rewards_user_created_idx
  ON user_rewards(user_id, created_at DESC);

INSERT INTO user_rewards
  (id, user_id, source_code_id, reward_type, reward_value, display_name, equipped, created_at)
SELECT lower(hex(randomblob(16))),
       redemptions.user_id,
       CASE WHEN codes.secret = 0 THEN redemptions.code_id ELSE NULL END,
       redemptions.reward_type,
       redemptions.reward_value,
       CASE
         WHEN redemptions.reward_type = 'premium' THEN 'Premium'
         ELSE COALESCE(NULLIF(redemptions.reward_value, ''), redemptions.reward_type)
       END,
       0,
       redemptions.redeemed_at
FROM code_redemptions AS redemptions
JOIN redeem_codes AS codes ON codes.id = redemptions.code_id
WHERE redemptions.user_id IS NOT NULL
  AND codes.secret = 0;

DELETE FROM code_redemptions
WHERE code_id IN (SELECT id FROM redeem_codes WHERE secret = 1);

DELETE FROM code_rewards
WHERE code_id IN (SELECT id FROM redeem_codes WHERE secret = 1);

DELETE FROM redeem_codes WHERE secret = 1;

ALTER TABLE redeem_codes DROP COLUMN secret;
