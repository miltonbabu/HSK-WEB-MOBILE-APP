// React context wrapper around the data source.
// Screens / stores call useDataSource() once, then talk to it.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getDataSource } from '@/db';
import { useAuthStore } from '@/stores/auth';
import type { DataSource } from '@/db/types';

const DataSourceContext = createContext<DataSource | null>(null);

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const [ds, setDs] = useState<DataSource | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const authInit = useAuthStore((s) => s.init);

  useEffect(() => {
    let mounted = true;
    getDataSource()
      .then(async (d) => {
        if (!mounted) return;
        setDs(d);
        // Pre-fetch vocab into cache so screens load instantly
        d.vocab.init().catch(() => {});
        // Restore saved auth session
        try { await authInit(); } catch { /* ignore */ }
      })
      .catch(e => { if (mounted) setError(e instanceof Error ? e : new Error(String(e))); });
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color="#a855f7" />
      </View>
    );
  }
  if (!ds) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf5ff' }}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }
  return (
    <DataSourceContext.Provider value={ds}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource(): DataSource {
  const ds = useContext(DataSourceContext);
  if (!ds) throw new Error('useDataSource() must be used inside <DataSourceProvider>');
  return ds;
}
