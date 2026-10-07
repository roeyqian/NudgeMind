CREATE TABLE research_exposures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stimulus_id TEXT NOT NULL,
  version TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  evidence_text TEXT NOT NULL,
  stage TEXT NOT NULL,
  locale TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, stimulus_id)
);
CREATE INDEX idx_research_exposures_user_product ON research_exposures(user_id, product_id);
