CREATE TABLE pattern_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('scarcity', 'social_proof', 'price_anchor')),
  evidence_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);
CREATE INDEX idx_pattern_events_user_product
  ON pattern_events(user_id, product_id, created_at);
