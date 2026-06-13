// ============================================================
// Data source factory
// ------------------------------------------------------------
// Swap implementations here. The rest of the app imports the
// React context from "@/db/context" and never sees this file.
// ============================================================

import Constants from 'expo-constants';
import type { DataSource } from '@/db/types';
import { createSqliteDataSourceAsync } from '@/db/sqlite';

export type DataSourceKind = 'sqlite' | 'supabase';

function pickKind(): DataSourceKind {
  // Override via app.json -> expo.extra.dataSource
  const k = (Constants.expoConfig?.extra as any)?.dataSource;
  if (k === 'supabase' || k === 'sqlite') return k;
  return 'sqlite';
}

let _ds: DataSource | null = null;
let _initPromise: Promise<DataSource> | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (_ds) return _ds;
  if (_initPromise) return _initPromise;

  const kind = pickKind();
  _initPromise = (async () => {
    if (kind === 'sqlite') {
      _ds = await createSqliteDataSourceAsync();
    } else {
      // Lazy import so the supabase SDK isn't bundled until needed
      const { createSupabaseDataSource } = await import('@/db/supabase');
      _ds = await createSupabaseDataSource();
    }
    return _ds;
  })();
  return _initPromise;
}

export function getCachedDataSource(): DataSource | null {
  return _ds;
}
