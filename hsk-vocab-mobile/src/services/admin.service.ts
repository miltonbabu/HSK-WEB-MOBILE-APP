// Admin service for the mobile app.
// Intentionally mirrors hsk-vocab-app/src/services/admin.service.ts so
// the admin panel has identical behavior on web and mobile.
//
// Auth model:
//  - There is NO separate "admin login screen" on mobile.
//  - A regular user becomes admin if their row in user_profiles has
//    `is_admin = 1` (or if their email matches the super-admin email).
//  - The SUPER_ADMIN_EMAIL user can promote/demote other admins and
//    permanently delete user accounts. Regular admins can manage
//    vocabulary and reset passwords / clear user data, but cannot
//    promote other admins or hard-delete users.

import { getDataSource } from '@/db';
import type { AdminUserRow, AdminWord } from '@/types';

// Matches hsk-vocab-app/src/services/admin.service.ts
export const SUPER_ADMIN_EMAIL = 'miltonbabu9666@gmail.com';

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return String(email).toLowerCase() === SUPER_ADMIN_EMAIL;
}

function toAdminWord(r: any): AdminWord {
  return {
    id: String(r.id),
    hsk_level: Number(r.hsk_level) || 1,
    chinese: String(r.chinese ?? ''),
    pinyin: String(r.pinyin ?? ''),
    english: String(r.english ?? ''),
    pos: typeof r.pos === 'string' ? r.pos : JSON.stringify(r.pos ?? []),
    example_sentences: typeof r.example_sentences === 'string' ? r.example_sentences : JSON.stringify(r.example_sentences ?? []),
    topic_category: String(r.topic_category ?? 'general'),
    created_at: r.created_at,
  };
}

export const adminService = {
  // ---------- Vocabulary ----------

  async getVocabulary(
    level?: number,
    search?: string,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<{ words: AdminWord[]; total: number }> {
    const ds = await getDataSource();
    const { words, total } = await ds.vocab.paginated({ level, query: search, page, pageSize });
    return { words: words.map(toAdminWord), total };
  },

  async getWord(id: string): Promise<AdminWord | null> {
    const ds = await getDataSource();
    const w = await ds.vocab.getWordById(id);
    return w ? toAdminWord(w) : null;
  },

  async createWord(word: Partial<AdminWord>): Promise<string> {
    if (!word.chinese || !String(word.chinese).trim()) throw new Error('Chinese text is required');
    if (!word.pinyin || !String(word.pinyin).trim()) throw new Error('Pinyin is required');
    if (!word.english || !String(word.english).trim()) throw new Error('English meaning is required');
    if (word.hsk_level !== undefined && (word.hsk_level < 1 || word.hsk_level > 6)) {
      throw new Error('HSK level must be between 1 and 6');
    }

    const ds = await getDataSource();
    const id = await ds.vocab.createWord({
      hsk_level: word.hsk_level && word.hsk_level > 0 ? word.hsk_level : 1,
      chinese: String(word.chinese).trim(),
      pinyin: String(word.pinyin).trim(),
      english: String(word.english).trim(),
      pos: word.pos || '[]',
      example_sentences: word.example_sentences || '[]',
      topic_category: word.topic_category || 'general',
    });
    return String(id);
  },

  async updateWord(id: string, updates: Partial<AdminWord>): Promise<void> {
    if (updates.hsk_level !== undefined && (updates.hsk_level < 1 || updates.hsk_level > 6)) {
      throw new Error('HSK level must be between 1 and 6');
    }

    const ds = await getDataSource();
    const payload: {
      hsk_level?: number;
      chinese?: string;
      pinyin?: string;
      english?: string;
      pos?: string;
      example_sentences?: string;
      topic_category?: string;
    } = {};

    if (updates.hsk_level !== undefined) {
      const v = Number(updates.hsk_level);
      if (!v || v < 1 || v > 6) throw new Error('HSK level must be between 1 and 6');
      payload.hsk_level = v;
    }
    if (updates.chinese !== undefined) {
      const v = String(updates.chinese).trim();
      if (!v) throw new Error('Chinese text is required');
      payload.chinese = v;
    }
    if (updates.pinyin !== undefined) {
      const v = String(updates.pinyin).trim();
      if (!v) throw new Error('Pinyin is required');
      payload.pinyin = v;
    }
    if (updates.english !== undefined) {
      const v = String(updates.english).trim();
      if (!v) throw new Error('English meaning is required');
      payload.english = v;
    }
    if (updates.pos !== undefined) payload.pos = updates.pos;
    if (updates.example_sentences !== undefined) payload.example_sentences = updates.example_sentences;
    if (updates.topic_category !== undefined) payload.topic_category = updates.topic_category;

    await ds.vocab.updateWord(id, payload);
  },

  async deleteWord(id: string): Promise<void> {
    if (!id) throw new Error('Invalid word id');
    const ds = await getDataSource();
    await ds.vocab.deleteWord(id);
  },

  // ---------- Users ----------

  async getUsers(): Promise<AdminUserRow[]> {
    const ds = await getDataSource();
    return (await ds.users.list()).map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      is_admin: !!u.is_admin,
      is_active: u.is_active !== false,
      source: (u as any).source || 'mobile',
      created_at: u.created_at,
    }));
  },

  async createUser(
    user: { username: string; email: string; password: string; is_admin?: boolean },
    actorIsSuper: boolean,
  ): Promise<string> {
    if (!user.username || !user.username.trim()) throw new Error('Username is required');
    if (!user.email || !user.email.trim()) throw new Error('Email is required');
    if (!user.password || user.password.length < 4) throw new Error('Password must be at least 4 characters');
    if (user.is_admin && !actorIsSuper) throw new Error('Only super-admin can create other admins');

    const ds = await getDataSource();
    return await ds.users.create({
      username: user.username.trim(),
      email: user.email.trim(),
      password: user.password,
      is_admin: !!user.is_admin,
    });
  },

  async updateUser(
    id: string,
    updates: { username?: string; email?: string; is_admin?: boolean; is_active?: boolean; password?: string },
    actorIsSuper: boolean,
  ): Promise<void> {
    if (updates.is_admin !== undefined && !actorIsSuper) {
      // Ignore non-super attempts to change admin status. Throwing is
      // clearer than silently ignoring, but we preserve the rest of the
      // update by stripping the field first.
      const { is_admin: _ignored, ...rest } = updates;
      return adminService.updateUser(id, rest, actorIsSuper);
    }
    // Protect the super admin account.
    const ds = await getDataSource();
    const rows = await ds.users.list();
    const target = rows.find((r) => r.id === id);
    if (target && isSuperAdmin(target.email)) {
      if (updates.is_admin === false) throw new Error('Super-admin role cannot be removed');
      if (updates.email && !isSuperAdmin(updates.email)) throw new Error('Super-admin email cannot be changed');
    }

    await ds.users.update(id, {
      username: updates.username ? updates.username.trim() : undefined,
      email: updates.email ? updates.email.trim() : undefined,
      is_admin: updates.is_admin,
      is_active: updates.is_active,
      password: updates.password,
    });
  },

  async resetPassword(id: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters');
    const ds = await getDataSource();
    await ds.users.update(id, { password: newPassword });
  },

  async softDeleteUser(id: string): Promise<void> {
    const ds = await getDataSource();
    await ds.users.update(id, { is_active: false });
  },

  async restoreUser(id: string): Promise<void> {
    const ds = await getDataSource();
    await ds.users.update(id, { is_active: true });
  },

  async hardDeleteUser(id: string, actorIsSuper: boolean): Promise<void> {
    if (!actorIsSuper) throw new Error('Only super-admin can permanently delete users');
    const ds = await getDataSource();
    const rows = await ds.users.list();
    const target = rows.find((r) => r.id === id);
    if (target && isSuperAdmin(target.email)) throw new Error('Super-admin cannot delete self');
    await ds.users.hardDelete(id);
  },

  async clearUserData(id: string): Promise<void> {
    const ds = await getDataSource();
    await ds.users.clearData(id);
  },

  async getStats() {
    const ds = await getDataSource();
    const totalUsers = await ds.users.totalCount();
    const totalWords = await ds.vocab.totalCount();
    const byLevel = await ds.vocab.countByLevel();
    const recent = (await ds.users.list()).slice(0, 5).map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      created_at: u.created_at,
    }));
    return { totalUsers, totalWords, byLevel, recent };
  },
};
