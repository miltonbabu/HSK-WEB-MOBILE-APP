import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Shield,
} from 'lucide-react-native';
import { adminService, isSuperAdmin } from '@/services/admin.service';
import { useAuthStore } from '@/stores/auth';
import type { AdminWord } from '@/types';

interface WordForm {
  hsk_level: number;
  chinese: string;
  pinyin: string;
  english: string;
  pos: string;
  example_sentences: string;
  topic_category: string;
}

const emptyForm: WordForm = {
  hsk_level: 1,
  chinese: '',
  pinyin: '',
  english: '',
  pos: '[]',
  example_sentences: '[]',
  topic_category: 'general',
};

function validateJsonField(value: string): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) && typeof parsed !== 'object') {
      return 'Must be a JSON array or object';
    }
    return null;
  } catch {
    return 'Invalid JSON';
  }
}

export default function AdminVocabularyScreen() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.is_admin === true;
  const isSuper = user?.is_super === true || isSuperAdmin(user?.email ?? null);

  const [words, setWords] = useState<AdminWord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WordForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const { words: next, total: t } = await adminService.getVocabulary(levelFilter, search, page, pageSize);
      setWords(next);
      setTotal(t);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load words');
    } finally {
      setLoading(false);
    }
  }, [page, levelFilter, search]);

  useEffect(() => { loadWords(); }, [loadWords]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setError('');
    setShowForm(true);
  };

  const handleEdit = (word: AdminWord) => {
    setEditingId(word.id);
    setForm({
      hsk_level: word.hsk_level,
      chinese: word.chinese,
      pinyin: word.pinyin,
      english: word.english,
      pos: word.pos,
      example_sentences: word.example_sentences,
      topic_category: word.topic_category,
    });
    setFormError('');
    setError('');
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.chinese.trim() || !form.pinyin.trim() || !form.english.trim()) {
      setFormError('Chinese, pinyin, and English are required');
      return;
    }
    const posErr = validateJsonField(form.pos);
    if (posErr) { setFormError('Part of speech: ' + posErr); return; }
    const sentErr = validateJsonField(form.example_sentences);
    if (sentErr) { setFormError('Example sentences: ' + sentErr); return; }

    setFormError('');
    setSaving(true);
    try {
      if (editingId) {
        await adminService.updateWord(editingId, form);
        showToast('Word updated');
      } else {
        const newId = await adminService.createWord(form);
        if (!newId) throw new Error('Failed to create word');
        showToast('Word created');
      }
      closeModal();
      loadWords();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save word');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await adminService.deleteWord(deleteConfirm);
      showToast('Word deleted');
      loadWords();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete word');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={22} color="#0f172a" />
          </Pressable>
          <Text className="text-lg font-bold text-slate-900">Vocabulary</Text>
          <Text className="text-xs text-slate-500 ml-2">{total} words</Text>
        </View>
        {canEdit && (
          <Pressable
            onPress={handleCreate}
            className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 active:opacity-80"
          >
            <Plus size={16} color="white" />
            <Text className="text-white text-sm font-semibold">Add</Text>
          </Pressable>
        )}
      </View>

      <View className="flex-row gap-2 px-4 py-2 border-b border-slate-100">
        <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
          <Search size={16} color="#64748b" />
          <TextInput
            value={search}
            onChangeText={(t) => { setSearch(t); setPage(1); }}
            placeholder="Search..."
            className="flex-1 ml-2 text-sm text-slate-900"
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={loadWords}
          className="items-center justify-center px-3 rounded-xl bg-slate-100 active:opacity-80"
        >
          <RefreshCw size={18} color="#64748b" />
        </Pressable>
      </View>

      <View className="flex-row gap-2 px-4 py-2">
        {[{ key: 'all', label: 'All' as const, value: undefined as number | undefined },
          { key: '1', label: '1', value: 1 },
          { key: '2', label: '2', value: 2 },
          { key: '3', label: '3', value: 3 },
          { key: '4', label: '4', value: 4 },
          { key: '5', label: '5', value: 5 },
          { key: '6', label: '6', value: 6 }].map((lvl) => (
          <Pressable
            key={lvl.key}
            onPress={() => { setLevelFilter(lvl.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg ${
              levelFilter === lvl.value
                ? 'bg-indigo-600'
                : 'bg-slate-100'
            }`}
          >
            <Text className={`text-xs font-medium ${
              levelFilter === lvl.value ? 'text-white' : 'text-slate-700'
            }`}>{lvl.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View className="mx-4 my-2 p-3 rounded-xl bg-red-50 flex-row items-center gap-2">
          <AlertCircle size={16} color="#dc2626" />
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator color="#4f46e5" />
          </View>
        ) : words.length === 0 ? (
          <View className="items-center justify-center py-16 px-6">
            <BookOpen size={32} color="#94a3b8" />
            <Text className="text-base font-semibold text-slate-700 mt-3">No words found</Text>
            {canEdit && (
              <Pressable
                onPress={handleCreate}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 active:opacity-80"
              >
                <Text className="text-white text-sm font-semibold">Add first word</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View className="px-4 pt-2">
            {words.map((w) => (
              <View
                key={w.id}
                className="flex-row items-center justify-between p-3 mb-2 rounded-xl border border-slate-200 bg-white"
              >
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-slate-900">{w.chinese}</Text>
                    <View className="px-2 py-0.5 rounded-md bg-indigo-50">
                      <Text className="text-[10px] font-bold text-indigo-700">HSK {w.hsk_level}</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-slate-600 mt-0.5 italic">{w.pinyin}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>{w.english}</Text>
                </View>
                {canEdit && (
                  <View className="flex-row items-center gap-1">
                    <Pressable
                      onPress={() => handleEdit(w)}
                      className="p-2 rounded-lg bg-slate-100 active:opacity-70"
                    >
                      <Edit3 size={16} color="#334155" />
                    </Pressable>
                    {isSuper && (
                      <Pressable
                        onPress={() => setDeleteConfirm(w.id)}
                        className="p-2 rounded-lg bg-red-50 active:opacity-70"
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {total > pageSize && (
          <View className="flex-row items-center justify-between px-4 pt-4">
            <Pressable
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 active:opacity-70 disabled:opacity-40"
            >
              <ChevronLeft size={16} color="#334155" />
              <Text className="text-sm text-slate-700">Prev</Text>
            </Pressable>
            <Text className="text-sm font-medium text-slate-600">{page} / {totalPages}</Text>
            <Pressable
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 active:opacity-70 disabled:opacity-40"
            >
              <Text className="text-sm text-slate-700">Next</Text>
              <ChevronRight size={16} color="#334155" />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="bg-white rounded-t-3xl max-h-[90%]">
            <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
              <Text className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Word' : 'Add New Word'}
              </Text>
              <Pressable onPress={closeModal} className="p-2 -mr-2">
                <X size={20} color="#475569" />
              </Pressable>
            </View>

            <ScrollView className="max-h-[70%]" contentContainerStyle={{ padding: 16 }}>
              {formError ? (
                <View className="mb-3 p-3 rounded-xl bg-red-50 flex-row items-center gap-2">
                  <AlertCircle size={16} color="#dc2626" />
                  <Text className="text-sm text-red-700 flex-1">{formError}</Text>
                </View>
              ) : null}

              <View className="flex-row gap-2 mb-3">
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-slate-700 mb-1">HSK Level</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map((lvl) => (
                      <Pressable
                        key={lvl}
                        onPress={() => setForm({ ...form, hsk_level: lvl })}
                        className={`px-3 py-1.5 rounded-lg ${
                          form.hsk_level === lvl ? 'bg-indigo-600' : 'bg-slate-100'
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${
                          form.hsk_level === lvl ? 'text-white' : 'text-slate-700'
                        }`}>{lvl}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">Category</Text>
                <TextInput
                  value={form.topic_category}
                  onChangeText={(t) => setForm({ ...form, topic_category: t })}
                  placeholder="general"
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">Chinese *</Text>
                <TextInput
                  value={form.chinese}
                  onChangeText={(t) => setForm({ ...form, chinese: t })}
                  placeholder="你好"
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-lg text-slate-900 font-bold"
                />
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">Pinyin *</Text>
                <TextInput
                  value={form.pinyin}
                  onChangeText={(t) => setForm({ ...form, pinyin: t })}
                  placeholder="nǐ hǎo"
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">English *</Text>
                <TextInput
                  value={form.english}
                  onChangeText={(t) => setForm({ ...form, english: t })}
                  placeholder="hello"
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">Part of Speech (JSON array)</Text>
                <TextInput
                  value={form.pos}
                  onChangeText={(t) => setForm({ ...form, pos: t })}
                  placeholder='["verb", "noun"]'
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 font-mono"
                />
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">Example Sentences (JSON array)</Text>
                <TextInput
                  value={form.example_sentences}
                  onChangeText={(t) => setForm({ ...form, example_sentences: t })}
                  placeholder='["你好，我是小明。"]'
                  multiline
                  numberOfLines={3}
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 font-mono"
                />
              </View>

              <View className="flex-row gap-2 mt-4">
                <Pressable onPress={closeModal} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 active:opacity-70 items-center">
                  <Text className="text-sm font-semibold text-slate-700">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="flex-1 flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 active:opacity-80 disabled:opacity-60"
                >
                  {saving ? <ActivityIndicator color="white" /> : null}
                  <Text className="text-sm font-semibold text-white">{editingId ? 'Save Changes' : 'Add Word'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation */}
      <Modal visible={!!deleteConfirm} animationType="fade" transparent onRequestClose={() => setDeleteConfirm(null)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-8">
          <View className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
                <AlertCircle size={20} color="#dc2626" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-900">Delete Word</Text>
                <Text className="text-xs text-slate-500">This action cannot be undone.</Text>
              </View>
            </View>
            <View className="flex-row gap-2 mt-2">
              <Pressable
                onPress={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 active:opacity-70 items-center"
              >
                <Text className="text-sm font-semibold text-slate-700">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 active:opacity-80 items-center"
              >
                <Text className="text-sm font-semibold text-white">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toast ? (
        <View className="absolute bottom-6 left-0 right-0 items-center">
          <View className="bg-slate-900 px-4 py-2.5 rounded-xl shadow-lg">
            <Text className="text-white text-sm font-medium">{toast}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
