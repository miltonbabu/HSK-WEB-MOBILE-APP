import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { adminService, VocabularyWord } from '@/services/admin.service'
import {
  Search, Plus, Edit3, Trash2, RefreshCw, AlertCircle,
  X, Check, ChevronLeft, ChevronRight, BookOpen, Filter
} from 'lucide-react'

interface WordForm {
  hsk_level: number
  chinese: string
  pinyin: string
  english: string
  pos: string
  example_sentences: string
  topic_category: string
}

const emptyForm: WordForm = {
  hsk_level: 1,
  chinese: '',
  pinyin: '',
  english: '',
  pos: '[]',
  example_sentences: '[]',
  topic_category: 'general',
}

function validateJsonField(value: string, fieldLabel: string): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed) && typeof parsed !== 'object') {
      return `${fieldLabel} must be a JSON array or object`
    }
    return null
  } catch {
    return `${fieldLabel} is not valid JSON`
  }
}

export default function AdminVocabulary() {
  const [words, setWords] = useState<VocabularyWord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const pageSize = 25

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<WordForm>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const loadWords = async () => {
    setLoading(true)
    try {
      const { words, total } = await adminService.getVocabulary(levelFilter, search, page, pageSize)
      setWords(words)
      setTotal(total)
    } catch (err: any) {
      setError(err.message || 'Failed to load words')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWords() }, [page, levelFilter, search])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setError('')
    setShowForm(true)
  }

  const handleEdit = (word: VocabularyWord) => {
    setEditingId(word.id)
    setForm({
      hsk_level: word.hsk_level,
      chinese: word.chinese,
      pinyin: word.pinyin,
      english: word.english,
      pos: word.pos,
      example_sentences: word.example_sentences,
      topic_category: word.topic_category,
    })
    setFormError('')
    setError('')
    setShowForm(true)
  }

  const closeModal = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError('')
  }

  const handleSave = async () => {
    if (!form.chinese.trim() || !form.pinyin.trim() || !form.english.trim()) {
      setFormError('Chinese, pinyin, and English are required')
      return
    }
    const posErr = validateJsonField(form.pos, 'Part of Speech')
    if (posErr) { setFormError(posErr); return }
    const sentErr = validateJsonField(form.example_sentences, 'Example Sentences')
    if (sentErr) { setFormError(sentErr); return }

    setFormError('')
    setSaving(true)
    try {
      if (editingId) {
        await adminService.updateWord(editingId, form)
        showToast('Word updated')
      } else {
        const newId = await adminService.createWord(form)
        if (!newId) throw new Error('Failed to create word')
        showToast('Word created')
      }
      closeModal()
      loadWords()
    } catch (err: any) {
      setFormError(err.message || 'Failed to save word')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await adminService.deleteWord(deleteConfirm)
      showToast('Word deleted')
      loadWords()
    } catch (err: any) {
      setFormError(err.message || 'Failed to delete word')
    } finally {
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Vocabulary</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            {total} words across HSK levels 1-4
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadWords} className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button onClick={handleCreate} className="btn-primary !px-3 !py-2 text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Word
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by character, pinyin, or meaning..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-ink-400 hidden sm:block" />
          {[undefined, 1, 2, 3, 4].map((lv) => (
            <button
              key={lv ?? 'all'}
              onClick={() => { setLevelFilter(lv); setPage(1) }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                levelFilter === lv
                  ? 'bg-brand-500 text-white'
                  : 'bg-ink-50 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'
              }`}
            >
              {lv === undefined ? 'All' : `HSK ${lv}`}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-ink-500 border-t-transparent" />
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-16 text-ink-400 dark:text-ink-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No words found</p>
          <button onClick={handleCreate} className="mt-4 btn-primary text-sm">Add first word</button>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/50">
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 w-16">HSK</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500">Chinese</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden sm:table-cell">Pinyin</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden md:table-cell">English</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden lg:table-cell">Category</th>
                  <th className="text-right py-3 px-4 font-medium text-ink-400 dark:text-ink-500 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id} className="border-b border-ink-50 dark:border-ink-800 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        {word.hsk_level}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-ink-900 dark:text-white">{word.chinese}</td>
                    <td className="py-2.5 px-4 text-ink-500 dark:text-ink-400 hidden sm:table-cell">{word.pinyin}</td>
                    <td className="py-2.5 px-4 text-ink-500 dark:text-ink-400 hidden md:table-cell truncate max-w-[200px]">{word.english}</td>
                    <td className="py-2.5 px-4 text-ink-400 dark:text-ink-500 hidden lg:table-cell text-xs">{word.topic_category}</td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(word)}
                          className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                          title="Edit word"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(word.id)}
                          className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete word"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-100 dark:border-ink-700">
            <span className="text-xs text-ink-500 dark:text-ink-400">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg disabled:opacity-40 text-ink-400 dark:text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-ink-600 dark:text-ink-300 min-w-[60px] text-center">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg disabled:opacity-40 text-ink-400 dark:text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors disabled:hover:bg-transparent"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-ink-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-ink-900 dark:text-white">
                  {editingId ? 'Edit Word' : 'Add New Word'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">HSK Level</label>
                    <select
                      value={form.hsk_level}
                      onChange={(e) => setForm({ ...form, hsk_level: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30"
                    >
                      {[1, 2, 3, 4].map((lv) => <option key={lv} value={lv}>HSK {lv}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Category</label>
                    <input
                      type="text"
                      value={form.topic_category}
                      onChange={(e) => setForm({ ...form, topic_category: e.target.value })}
                      className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Chinese *</label>
                  <input
                    type="text"
                    value={form.chinese}
                    onChange={(e) => setForm({ ...form, chinese: e.target.value })}
                    placeholder="e.g. 你好"
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-lg font-medium outline-none focus:ring-2 focus:ring-brand-400/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Pinyin *</label>
                  <input
                    type="text"
                    value={form.pinyin}
                    onChange={(e) => setForm({ ...form, pinyin: e.target.value })}
                    placeholder="e.g. nǐ hǎo"
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">English Meaning *</label>
                  <input
                    type="text"
                    value={form.english}
                    onChange={(e) => setForm({ ...form, english: e.target.value })}
                    placeholder="e.g. hello"
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Part of Speech (JSON array)</label>
                  <input
                    type="text"
                    value={form.pos}
                    onChange={(e) => setForm({ ...form, pos: e.target.value })}
                    placeholder='["noun", "verb"]'
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Example Sentences (JSON array)</label>
                  <textarea
                    value={form.example_sentences}
                    onChange={(e) => setForm({ ...form, example_sentences: e.target.value })}
                    placeholder='["你好，我是小明。"]'
                    rows={2}
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30 font-mono text-xs resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-ink-100 dark:border-ink-700">
                <button onClick={closeModal} className="btn-secondary !px-4 !py-2 text-sm">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? 'Save Changes' : 'Add Word'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-ink-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Delete Word</h3>
                  <p className="text-sm text-ink-500 dark:text-ink-400">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !py-2 text-sm">Cancel</button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-5 py-2 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-ink-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
