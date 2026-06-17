// PwaInstallPrompt is intentionally a no-op: the unified install UI lives
// in `@/components/InstallPWA` (rendered once in App.tsx). This file is
// preserved only as a default-export shim in case any future code imports
// it; it renders nothing and consumes no props.

import { useEffect } from 'react'

// Mark the legacy "dismissed" key so older code that reads it still works.
const DISMISS_KEY = 'pwa-install-dismissed'

export default function PwaInstallPrompt() {
  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) {
        localStorage.setItem(DISMISS_KEY, String(Date.now()))
      }
    } catch {
      /* ignore */
    }
  }, [])

  return null
}
