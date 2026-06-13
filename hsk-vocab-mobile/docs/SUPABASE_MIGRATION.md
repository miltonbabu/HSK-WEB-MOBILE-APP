# =====================================================
# SUPABASE MIGRATION GUIDE
# =====================================================
# When you're ready to move from local SQLite to Supabase:
#
# 1. Install the SDK:
#      npm install @supabase/supabase-js
#
# 2. Create a .env (and EAS Build secrets in production):
#      EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
#      EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
#
# 3. Switch the data source flag in app.json:
#      "extra": { "dataSource": "supabase" }
#
# 4. Implement src/db/supabase/index.ts to match the
#    DataSource interface (see src/db/types.ts). Every
#    method has the same signature as the SQLite impl,
#    so no screen / store needs to change.
#
# 5. Run the schema in supabase/schema.sql (already in
#    the web app at hsk-vocab-app/supabase/schema.sql).
#    Optionally copy hsk JSON into a `words` table.
#
# 6. Auth: switch the local email/password flow to
#    supabase.auth.signInWithPassword(...) etc. — the
#    AuthRepository interface in src/db/types.ts is
#    already shaped for it.
#
# 7. Ship: eas build --profile production
#    Secrets injected via `eas env:create` or
#    expo-constants build-time inlining.
#
# =====================================================
