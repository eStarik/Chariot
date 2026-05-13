DROP TABLE IF EXISTS chariot_users;
CREATE TABLE IF NOT EXISTS chariots_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMP,
  image TEXT,
  password TEXT,
  role TEXT DEFAULT 'commander'
);
CREATE TABLE IF NOT EXISTS account (
  "userId" TEXT NOT NULL REFERENCES chariots_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (provider, "providerAccountId")
);
CREATE TABLE IF NOT EXISTS session (
  "sessionToken" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES chariots_users(id) ON DELETE CASCADE,
  expires TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS verificationToken (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP NOT NULL,
  PRIMARY KEY (identifier, token)
);
