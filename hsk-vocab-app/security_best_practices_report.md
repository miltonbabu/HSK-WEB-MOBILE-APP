# Security Audit Report — My HSK 4 Vocab App

**Date**: 2026-05-22  
**Scope**: Full frontend React 18 + TypeScript + Vite codebase  
**Framework**: React, Vite, Tailwind CSS, Zustand, Supabase, SQL.js (SQLite)  
**Methodology**: OWASP React Security Best Practices + OWASP Frontend Security Guidelines  

---

## Executive Summary

The codebase is in **reasonably good shape** for a development-stage app. No XSS sinks, no `eval`, no `dangerouslySetInnerHTML` were found — the React escaping-by-default pattern is being followed correctly. However, **3 critical-to-high findings** were identified around the JWT auth system, plus 2 medium-level recommendations for defense-in-depth.

---

## Findings

### 🔴 F-001 — Dev signIn bypasses password verification entirely

| Field | Detail |
|-------|--------|
| **Rule ID** | F-001 |
| **Severity** | **Critical** |
| **Location** | [sqlite-api.ts:L248-L266](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/sqlite-api.ts#L248-L266) |
| **Evidence** | `query('SELECT * FROM user_profiles WHERE email = ?', [email])` — only checks email, never validates password |
| **Impact** | Any user in dev mode can log into **any other user's account** knowing only their email address. No password required. This includes admin accounts. |
| **Fix** | Add password hashing to dev mode — hash the password with SHA-256 (or bcrypt if available), store the hash in a new `password_hash` column, and compare during signIn |

```typescript
// Current (INSECURE): no password check at all
const results = query('SELECT * FROM user_profiles WHERE email = ?', [email]);

// Fix: hash password and compare
const hashed = await hashPassword(_password);
const results = query(
  'SELECT * FROM user_profiles WHERE email = ? AND password_hash = ?', 
  [email, hashed]
);
```

---

### 🟠 F-002 — JWT tokens stored in localStorage (XSS exfiltration risk)

| Field | Detail |
|-------|--------|
| **Rule ID** | F-002 (REACT-AUTH-001 / JS-STORAGE-001) |
| **Severity** | **High** |
| **Location** | [supabase.ts:L22-L44](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/supabase.ts#L22-L44), [sqlite-api.ts:L212](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/sqlite-api.ts#L212), [sqlite-api.ts:L263](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/sqlite-api.ts#L263) |
| **Evidence** | `localStorage.setItem(JWT_KEY, token)` and `localStorage.setItem(ADMIN_JWT_KEY, token)` store long-lived JWTs (7-day expiry) in persistent Web Storage |
| **Impact** | If XSS occurs, all user and admin tokens are immediately exfiltratable. The 7-day expiry increases the attack window. |
| **Fix** | This is a **frontend-only app** with no backend server — HTTPOnly cookies aren't available. Mitigations: (1) Reduce mock JWT expiry from 7 days to 4 hours with silent refresh, (2) Add CSP to prevent inline scripts, (3) Token stored in memory-only with persistent backup as fallback |

---

### 🟠 F-003 — AdminLayout reads localStorage directly, bypassing auth service

| Field | Detail |
|-------|--------|
| **Rule ID** | F-003 (REACT-AUTHZ-001) |
| **Severity** | **High** |
| **Location** | [AdminLayout.tsx:L22](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/pages/admin/AdminLayout.tsx#L22) |
| **Evidence** | `const token = localStorage.getItem('hsk-admin-token')` — direct localStorage read bypassing `adminService.checkAuth()` which validates role + expiry |
| **Impact** | An attacker who sets a fake token in localStorage can bypass the admin login page's role/expiry checks, since the Layout only checks token existence, not validity |
| **Fix** | Use `adminService.checkAuth()` instead of direct localStorage access |

---

### 🟡 F-004 — No Content Security Policy deployed

| Field | Detail |
|-------|--------|
| **Rule ID** | F-004 (REACT-CSP-001) |
| **Severity** | **Medium** |
| **Location** | [index.html](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/index.html) |
| **Evidence** | No CSP header or meta tag present in the HTML entry point |
| **Impact** | No defense-in-depth against XSS. If any XSS vector were introduced, CSP could block it. |
| **Fix** | Add a `<meta http-equiv="Content-Security-Policy">` to index.html with a reasonable policy for the app |

---

### 🟡 F-005 — Dev mode admin login has no rate limiting

| Field | Detail |
|-------|--------|
| **Rule ID** | F-005 |
| **Severity** | **Medium** |
| **Location** | [admin.service.ts:L23-L50](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/admin.service.ts#L23-L50) |
| **Evidence** | No rate limiting on admin login attempts — brute force possible |
| **Impact** | Attackers can brute force admin credentials with no lockout mechanism |
| **Fix** | Add a simple in-memory rate limiter (max 5 attempts per minute) or use Supabase's built-in rate limiting in production |

---

## Summary

| Finding | Severity | Status |
|---------|----------|--------|
| F-001: Dev signIn ignores password | 🔴 Critical | Must fix |
| F-002: JWT in localStorage | 🟠 High | Mitigate |
| F-003: AdminLayout bypasses auth service | 🟠 High | Must fix |
| F-004: No CSP | 🟡 Medium | Recommended |
| F-005: No rate limiting on admin login | 🟡 Medium | Recommended |

**Positive findings**: No XSS sinks, no `dangerouslySetInnerHTML`, no `eval`, no `document.write`, no `postMessage` misconfigurations, no hardcoded secrets, no `javascript:` URLs. React's built-in escaping is used consistently.

---

*Generated by security-best-practices skill audit against OWASP React + Frontend JS/TS Security Best Practices.*