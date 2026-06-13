import initSqlJs from 'sql.js';

let db: any = null;
let isInitialized = false;

export async function ensureDb() {
  if (!isInitialized) {
    await initDatabase();
    isInitialized = true;
  }
}

export async function initDatabase() {
  if (db) return db;
  
  const SQL = await initSqlJs({
    locateFile: (_file: string) => `/sql-wasm.wasm`
  });
  db = new SQL.Database();
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hsk_level INTEGER NOT NULL CHECK (hsk_level BETWEEN 1 AND 4),
      chinese TEXT NOT NULL,
      pinyin TEXT NOT NULL,
      english TEXT DEFAULT '',
      pos TEXT DEFAULT '[]',
      pos_raw TEXT DEFAULT '',
      example_sentences TEXT DEFAULT '[]',
      audio_url TEXT DEFAULT '',
      radical TEXT DEFAULT '',
      stroke_count INTEGER DEFAULT 0,
      topic_category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      word_id INTEGER NOT NULL,
      mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
      last_reviewed DATETIME DEFAULT CURRENT_TIMESTAMP,
      next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
      review_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      easiness_factor REAL DEFAULT 2.50,
      interval INTEGER DEFAULT 1,
      UNIQUE(user_id, word_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      words_studied INTEGER DEFAULT 0,
      accuracy REAL DEFAULT 0,
      duration INTEGER DEFAULT 0,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      daily_goal INTEGER DEFAULT 20,
      streak_count INTEGER DEFAULT 0,
      last_study_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_admin INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      password_hash TEXT DEFAULT '',
      source TEXT DEFAULT 'web',
      hsk_level INTEGER DEFAULT 1,
      learning_reason TEXT DEFAULT NULL,
      onboarding_completed INTEGER DEFAULT 0
    )
  `);

  // Migration: add source column for existing databases
  try { db.run('ALTER TABLE user_profiles ADD COLUMN source TEXT DEFAULT \'web\''); } catch { /* already exists */ }
  try { db.run('ALTER TABLE user_profiles ADD COLUMN hsk_level INTEGER DEFAULT 1'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE user_profiles ADD COLUMN learning_reason TEXT DEFAULT NULL'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE user_profiles ADD COLUMN onboarding_completed INTEGER DEFAULT 0'); } catch { /* already exists */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      score INTEGER DEFAULT 0,
      accuracy REAL DEFAULT 0,
      mode TEXT NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_words_hsk_level ON words(hsk_level)');
  db.run('CREATE INDEX IF NOT EXISTS idx_words_topic ON words(topic_category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_progress_mastery ON user_progress(mastery_level)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user ON study_sessions(user_id)');

  // Migration: add is_admin column for existing databases
  try { db.run('ALTER TABLE user_profiles ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch {}
  // Migration: add password_hash column for existing databases
  try { db.run('ALTER TABLE user_profiles ADD COLUMN password_hash TEXT DEFAULT ""'); } catch {}
  // Migration: add is_active column for existing databases
  try { db.run('ALTER TABLE user_profiles ADD COLUMN is_active INTEGER DEFAULT 1'); } catch {}

  // Seed default admin user in dev mode
  try {
    const existing = query("SELECT id FROM user_profiles WHERE email = 'miltonbabu9666@gmail.com'");
    if (existing.length === 0) {
      run("INSERT INTO user_profiles (email, username, is_admin, password_hash) VALUES ('miltonbabu9666@gmail.com', 'Super Admin', 1, '')");
    }
  } catch {}

  console.log('SQLite database initialized successfully');
  
  return db;
}

export function getDatabase() {
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}

// Query helpers
export function query(sql: string, params?: any[]): any[] {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  
  stmt.free();
  return results;
}

export function run(sql: string, params?: any[]): void {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  stmt.step();
  stmt.free();
}

export function exec(sql: string): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql);
}

// Check if database has data
export function hasData(): boolean {
  try {
    const result = query('SELECT COUNT(*) as count FROM words');
    return result[0]?.count > 0;
  } catch {
    return false;
  }
}

// Get table row count
export function getTableCount(table: string): number {
  const result = query(`SELECT COUNT(*) as count FROM ${table}`);
  return result[0]?.count || 0;
}