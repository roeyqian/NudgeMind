CREATE TABLE IF NOT EXISTS ai_conversation_summaries (
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  ai_type TEXT NOT NULL CHECK (ai_type IN ('seller', 'guardian')),
  summary TEXT NOT NULL,
  summarized_until_rowid INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id, ai_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
