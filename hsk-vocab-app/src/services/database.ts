import initSqlJs from 'sql.js';

let db: any = null;
let isInitialized = false;

const DB_STORAGE_KEY = 'hsk-sqlite-db';

// Save database binary to localStorage
function saveDb(): void {
  if (!db) return;
  try {
    const binary = db.export();
    const base64 = arrayBufferToBase64(binary);
    localStorage.setItem(DB_STORAGE_KEY, base64);
  } catch (e) {
    console.warn('Failed to save database to localStorage:', e);
  }
}

// Load database binary from localStorage
function loadDb(): Uint8Array | null {
  try {
    const base64 = localStorage.getItem(DB_STORAGE_KEY);
    if (!base64) return null;
    const binary = base64ToArrayBuffer(base64);
    return new Uint8Array(binary);
  } catch (e) {
    console.warn('Failed to load database from localStorage:', e);
    return null;
  }
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Debounced save to avoid excessive writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveDb, 500);
}

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

  let loadedFromStorage = false;
  // Try to load existing database from localStorage
  const saved = loadDb();
  if (saved) {
    try {
      const candidate = new SQL.Database(saved);
      // Verify the database is intact by running a simple query
      try {
        candidate.exec('SELECT 1 FROM user_profiles LIMIT 1');
        db = candidate;
        loadedFromStorage = true;
        console.log('SQLite database loaded from localStorage');
      } catch {
        // Database corrupted, create fresh
        console.warn('Loaded database appears corrupted, creating fresh');
      }
    } catch {
      console.warn('Failed to load saved database, creating fresh');
    }
  }
  if (!db) db = new SQL.Database();

  // Always run schema creation + migrations on init. CREATE TABLE IF NOT
  // EXISTS and the wrapped ALTER TABLEs are idempotent, so they safely
  // upgrade databases saved by older versions of the app (which is what
  // caused the "no such table: usage_logs" crash for returning users).
  createSchema(db);
  runMigrations(db);
  scheduleSave();
  console.log('SQLite database initialized successfully');

  // Mark the first run as done so the app doesn't re-seed vocabulary
  // (seedVocabulary is only called from main.tsx when word count < target).
  void loadedFromStorage;

  return db;
}

function createSchema(database: any) {
  database.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hsk_level INTEGER NOT NULL CHECK (hsk_level BETWEEN 1 AND 6),
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

  database.run(`
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
      is_loved INTEGER DEFAULT 0,
      UNIQUE(user_id, word_id)
    )
  `);

  // Migrate existing databases that were created before is_loved was added
  try {
    database.run('ALTER TABLE user_progress ADD COLUMN is_loved INTEGER DEFAULT 0');
  } catch (_) {
    // column already exists — safe to ignore
  }

  database.run(`
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

  database.run(`
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

  database.run(`
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

  // usage_logs: rate-limit tracking for guest user mode access.
  // This table was added in a later release, so the `createSchema` step
  // is what upgrades older saved databases that don't have it yet.
  database.run(`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      mode_id TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME
    )
  `);

  // chat_sessions + chat_messages: AI tutor history. Persisted for
  // registered users so their conversations survive across devices/browsers
  // once they sign in. Guests still keep their history in localStorage.
  database.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      mode TEXT NOT NULL,
      context_id TEXT,
      context_title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      words TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  database.run('CREATE INDEX IF NOT EXISTS idx_words_hsk_level ON words(hsk_level)');
  database.run('CREATE INDEX IF NOT EXISTS idx_words_topic ON words(topic_category)');
  database.run('CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_progress_mastery ON user_progress(mastery_level)');
  database.run('CREATE INDEX IF NOT EXISTS idx_sessions_user ON study_sessions(user_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_logs(user_id, started_at)');
  database.run('CREATE INDEX IF NOT EXISTS idx_usage_user_mode_date ON usage_logs(user_id, mode_id, started_at)');
  database.run('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC)');
  database.run('CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, timestamp)');
}

function runMigrations(database: any) {
  // Each ALTER TABLE is wrapped in a try/catch — they fail with "duplicate
  // column" on databases that already have the column, which is expected.
  try { database.run("ALTER TABLE user_profiles ADD COLUMN source TEXT DEFAULT 'web'"); } catch { /* already exists */ }
  try { database.run('ALTER TABLE user_profiles ADD COLUMN hsk_level INTEGER DEFAULT 1'); } catch { /* already exists */ }
  try { database.run('ALTER TABLE user_profiles ADD COLUMN learning_reason TEXT DEFAULT NULL'); } catch { /* already exists */ }
  try { database.run('ALTER TABLE user_profiles ADD COLUMN onboarding_completed INTEGER DEFAULT 0'); } catch { /* already exists */ }
  try { database.run('ALTER TABLE user_profiles ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch { /* already exists */ }
  try { database.run('ALTER TABLE user_profiles ADD COLUMN password_hash TEXT DEFAULT ""'); } catch { /* already exists */ }
  try { database.run('ALTER TABLE user_profiles ADD COLUMN is_active INTEGER DEFAULT 1'); } catch { /* already exists */ }

  // Cleanup: remove any previously seeded demo users so old databases also show real data
  try {
    const fakeEmails = [
      "'miltonbabu9666@gmail.com'",
      "'test@test.com'",
      "'lihua@test.com'",
      "'ming@test.com'",
    ];
    database.run(`DELETE FROM user_profiles WHERE email IN (${fakeEmails.join(', ')})`);
  } catch {}
}

export function getDatabase() {
  return db;
}

export async function closeDatabase() {
  if (db) {
    saveDb(); // Save before closing
    await db.close();
    db = null;
    isInitialized = false;
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
  
  // Auto-save after writes (immediate for DELETE, debounced for INSERT/UPDATE)
  const upperSql = sql.trim().toUpperCase();
  if (upperSql.startsWith('DELETE') || upperSql.startsWith('DROP')) {
    saveDb(); // Immediate save for destructive operations
  } else if (upperSql.startsWith('INSERT') || upperSql.startsWith('UPDATE')) {
    scheduleSave();
  }
}

export function exec(sql: string): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql);
  scheduleSave();
}

// Force immediate save
export function forceSaveDb(): void {
  saveDb();
}

// Clear the saved database (for reset)
export function clearSavedDb(): void {
  localStorage.removeItem(DB_STORAGE_KEY);
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