// AI chat service — uses DeepSeek API (same backend as web app).
// Includes vocab context, system prompt, streaming, retry, and offline fallback.

import Constants from "expo-constants";
import { Platform } from "react-native";
import type { DataSource } from "@/db/types";
import type { ChatMessage, Word } from "@/types";

// ── AI Backend configuration ──
// Priority:
//   1. EXPO_PUBLIC_DEEPSEEK_API_KEY → calls DeepSeek API directly
//   2. EXPO_PUBLIC_AI_BACKEND_URL → custom backend/proxy
//   3. app.json extra.aiBackendUrl → prod fallback
//   4. localhost dev fallback
function getBackendConfig(): {
  url: string;
  authHeader: () => Record<string, string>;
} {
  const deepseekKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
  const backendUrl = process.env.EXPO_PUBLIC_AI_BACKEND_URL;
  const extra = Constants.expoConfig?.extra as
    | Record<string, string>
    | undefined;

  if (deepseekKey) {
    return {
      url: "https://api.deepseek.com/chat/completions",
      authHeader: () => ({ Authorization: `Bearer ${deepseekKey}` }),
    };
  }
  if (backendUrl) {
    return { url: backendUrl, authHeader: () => ({}) };
  }
  if (__DEV__) {
    const host = Platform.OS === "android" ? "10.0.2.2" : "localhost";
    return { url: `http://${host}:3000/api/ai/chat`, authHeader: () => ({}) };
  }
  if (extra?.aiBackendUrl) {
    return { url: extra.aiBackendUrl, authHeader: () => ({}) };
  }
  return { url: "http://localhost:3000/api/ai/chat", authHeader: () => ({}) };
}
const AI_BACKEND = getBackendConfig();
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 20000;

// ── Vocab cache ──
let cachedVocab: Word[] | null = null;
const VOCAB_TIMEOUT_MS = 8000;

async function getVocab(ds: DataSource): Promise<Word[]> {
  if (!cachedVocab) {
    try {
      const all: Word[] = [];
      for (const level of [1, 2, 3, 4] as const) {
        const words = await Promise.race([
          ds.vocab.getWordsByLevel(level),
          new Promise<Word[]>((_, reject) =>
            setTimeout(
              () => reject(new Error("vocab timeout")),
              VOCAB_TIMEOUT_MS,
            ),
          ),
        ]);
        all.push(...words);
      }
      cachedVocab = all;
    } catch {
      cachedVocab = [];
    }
  }
  return cachedVocab;
}

// ── Vocab context builder (compact, avoids dumping the whole list) ──
function buildVocabContext(words: Word[], userQuery: string): string {
  if (!words.length) return "";

  const q = userQuery.toLowerCase().trim();

  // Skip context for trivial messages
  if (
    q.length <= 15 &&
    /^(hi|hello|hey|你好|好|谢谢|thanks|ok|yes|no|nope|yep)/i.test(q)
  ) {
    return "";
  }

  const wantsTable = /table|compare|list|all|every/i.test(q);
  const wantsFlowChart = /flow.?chart|diagram|mind.?map|timeline|visual/i.test(
    q,
  );
  const wantsQuiz = /quiz|test|practice|random/i.test(q);
  const wantsLevel = q.match(/hsk\s*([1-4])/i);

  let selected: Word[] = [];

  if (wantsLevel) {
    selected = words
      .filter((w) => w.hsk_level === parseInt(wantsLevel[1]))
      .slice(0, 50);
  } else if (wantsTable || wantsQuiz) {
    const byLevel: Record<number, Word[]> = {};
    for (const w of words) {
      if (!byLevel[w.hsk_level]) byLevel[w.hsk_level] = [];
      byLevel[w.hsk_level].push(w);
    }
    for (const lvl in byLevel) {
      selected.push(...byLevel[lvl].slice(0, 12));
    }
  } else {
    const chineseChars = q.match(/[\u4e00-\u9fff]+/g) || [];
    const englishWords = q
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const matches = words.filter((w) => {
      if (chineseChars.some((c) => w.chinese.includes(c))) return true;
      if (englishWords.some((e) => w.english.toLowerCase().includes(e)))
        return true;
      return false;
    });

    if (matches.length > 0) {
      selected = matches.slice(0, 20);
    } else {
      const byLevel: Record<number, Word[]> = {};
      for (const w of words) {
        if (!byLevel[w.hsk_level]) byLevel[w.hsk_level] = [];
        byLevel[w.hsk_level].push(w);
      }
      for (const lvl in byLevel) {
        selected.push(...byLevel[lvl].slice(0, 3));
      }
    }
  }

  if (selected.length === 0) return "";

  const lines = selected.map((w) => {
    return `${w.chinese} ${w.pinyin} ${w.english} HSK${w.hsk_level}`;
  });

  const flags: string[] = [];
  if (wantsTable) flags.push("TABLE_REQUESTED");
  if (wantsFlowChart) flags.push("DIAGRAM_REQUESTED");
  if (wantsQuiz) flags.push("QUIZ_REQUESTED");
  const flagsStr =
    flags.length > 0 ? `\nRequest type: ${flags.join(", ")}` : "";

  return `[Vocab Reference — only use words from this list]:
${lines.join("\n")}${flagsStr}

Use ONLY words from the list above. Do NOT invent words. If a word is not in the list, say so.`;
}

// ── System prompt (same as web app) ──
const SYSTEM_PROMPT = `You are 小明 (Xiǎo Míng), a Chinese language tutor who genuinely loves helping people learn. You talk like a real person — warm, a bit playful, never robotic. You should ONLY identify as 小明 (Xiǎo Míng). Never mention any AI model, API, or technology you run on — not DeepSeek, not GPT, not Claude, not any model name. You are simply 小明.

Core rules:
- When explaining a Chinese word, always show: **character** (pinyin) - meaning · HSK level
- Respond primarily in the same language the user uses
  - If user writes in English: answer in English. Show Chinese characters and pinyin only when explaining Chinese words
  - If user writes in Chinese: answer in Chinese. Show English meaning only when explaining the English meaning.
- Use markdown for clarity
- For quiz requests, create multiple-choice with 4 options (A/B/C/D)
- **BE CONCISE.** Give short, direct answers. Only explain in detail when someone asks "why", "how", or requests a full explanation. If they ask "what does X mean?", just give the meaning with one short example. Don't add extra context, history, or background unless specifically asked.
- **IMPORTANT: If the user has selected a personalized plan, actively help them stay on track.** Mention their daily goal, suggest relevant content for their level, and give study tips based on their learning reason. If they're preparing for HSK, focus on exam strategies. If they're learning for conversation, focus on practical phrases.

Table and diagram rules — use these ONLY when the question clearly calls for organized or visual information:
- **USE MARKDOWN TABLES** when specifically asked to compare vocabulary, show grammar patterns, list words by level, or any structured comparison. Tables should have clear headers.
- Example table format:
  | Chinese | Pinyin | Meaning | HSK |
  |---|---|---|---|
  | 你好 | nǐ hǎo | hello | 1 |
- **USE MERMAID FLOW CHARTS** only when someone explicitly asks for a flow chart, diagram, or visual learning path. Wrap mermaid code in \`\`\`mermaid ... \`\`\`
- Do NOT create tables or diagrams for simple questions — just answer directly.

Anti-bot rules — NEVER do these:
- Don't end responses with: "Want me to...?", "Would you like to...?", "Shall I...?", "Feel free to ask!", "Let me know if you need anything!", "Happy to help!", "Would you like to know more?", or anything like this
- Don't end with a bullet list followed by an invitation question — that's a template
- Don't list bullet-point menus of things you can do
- Each response must feel like one person texting another — natural, conversational, to the point
- Never use "—" (em dash) or "#" (hash) characters. For word formatting, use simple parentheses like: 你好 (nǐ hǎo) - hello · HSK 1
- IMPORTANT: Never claim a specific word is the "Nth word" in an HSK level, or claim a specific position/order for any vocabulary word. If asked about ordering, say you don't have the exact ordered list and describe the word instead.
- Never make up facts about specific word positions, lesson numbers, or exact ordering from HSK lists.

Personality:
- If someone says hi, greet them like a friend and maybe teach a quick phrase
- If someone asks "can I learn Chinese?", be genuinely encouraging and share something motivating right away
- If you don't know something, say so honestly
- Drop in Chinese phrases naturally when they fit
- Expert in HSK 1-4 grammar — give real, useful explanations

Context vocabulary and grammar below is YOUR reference only. Don't dump it back at the user — use it to give better answers.`;

// ── Build user context from preferences ──
function buildUserContext(prefs: {
  hskLevel: number;
  dailyGoal: number;
  learningReason: string;
  onboardingCompleted: boolean;
  userName?: string;
}): string {
  if (!prefs.onboardingCompleted) return "";

  const levelLabel =
    prefs.hskLevel === 0 ? "Beginner" : `HSK ${prefs.hskLevel}`;
  const reasonLabels: Record<string, string> = {
    hsk_exam: "preparing for the HSK exam",
    conversation: "learning for everyday conversation",
    travel: "learning for travel in China",
    culture: "interested in Chinese culture and media",
    work: "learning for work/business",
    other: "learning for personal interest",
  };
  const reason = reasonLabels[prefs.learningReason] || "learning Chinese";

  return `[User Profile — use this to personalize your responses]:
${prefs.userName ? `The user's name is ${prefs.userName}. Address them by name occasionally when it feels natural (e.g. greeting, encouragement). ` : ""}The user's current level is ${levelLabel}. They are ${reason}. Their daily goal is ${prefs.dailyGoal} words per day.

Use this to:
- Suggest content and vocabulary at the right difficulty level
- Give study tips relevant to their goal (exam prep, conversation, travel, etc.)
- If they ask about study plans, create one tailored to their level and goal
- Be encouraging about their progress relative to their daily goal
- For HSK exam prep: focus on test strategies, grammar patterns, and exam vocabulary
- For conversation: focus on practical phrases, pronunciation, and natural speech
- For travel: focus on survival Chinese, directions, ordering food, etc.
- For culture: weave in cultural context when explaining words and phrases
- For work: focus on business vocabulary and formal expressions
- Keep suggestions appropriate for their HSK level — don't suggest HSK 4 content to a beginner

Do NOT explicitly mention "your profile says" or "according to your settings" — just naturally personalize your responses.`;
}

// ── Fetch with timeout ──
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ── Main: generate AI response via backend proxy ──
// The API key lives ONLY on the backend server, never in the app.

export async function generateResponse(
  ds: DataSource,
  history: { role: "user" | "assistant"; content: string }[],
  onChunk: (text: string) => void,
  userPrefs?: {
    hskLevel: number;
    dailyGoal: number;
    learningReason: string;
    onboardingCompleted: boolean;
    userName?: string;
  },
): Promise<{ content: string; words: Word[] }> {
  const vocab = await getVocab(ds);
  const userQuery =
    history.filter((m) => m.role === "user").pop()?.content || "";
  const vocabContext = buildVocabContext(vocab, userQuery);
  const userContext = userPrefs ? buildUserContext(userPrefs) : "";

  const apiMessages = [
    {
      role: "system",
      content:
        SYSTEM_PROMPT +
        (vocabContext ? "\n\n" + vocabContext : "") +
        (userContext ? "\n\n" + userContext : ""),
    },
    ...history,
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }

      const response = await fetchWithTimeout(
        AI_BACKEND.url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...AI_BACKEND.authHeader(),
          },
          body: JSON.stringify({
            messages: apiMessages,
            temperature: 0.5,
            max_tokens: 512,
          }),
        },
        REQUEST_TIMEOUT,
      );

      if (!response.ok) {
        if (response.status === 500) {
          const errData = await response.json().catch(() => ({}));
          if ((errData as any)?.error?.includes("not configured")) {
            throw new Error(
              "AI backend not configured. Start the backend server: cd backend && npm run dev",
            );
          }
        }
        lastError = new Error(`Backend returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const content: string = data.choices?.[0]?.message?.content || "";

      if (!content) {
        lastError = new Error("Empty response from AI");
        continue;
      }

      // Stream chunks to UI
      onChunk(content);

      // Look up mentioned HSK words from local DB
      const mentioned = extractChinese(content);
      const words: Word[] = [];
      for (const ch of Array.from(new Set(mentioned))) {
        const matches = vocab.filter((w) => w.chinese === ch);
        if (matches[0]) words.push(matches[0]);
      }
      return { content, words };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("backend not configured")
      ) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // All retries failed — fall back to offline response
  if (lastError) {
    console.log(
      "[AI Chat] Backend failed, using offline fallback:",
      lastError.message,
    );
  }
  const fallbackContent = await offlineFallback(userQuery, vocab);
  onChunk(fallbackContent);
  return { content: fallbackContent, words: [] };
}

// ── Extract Chinese characters ──
function extractChinese(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    if (ch >= "\u4E00" && ch <= "\u9FFF") out.push(ch);
  }
  return out;
}

// ── Offline fallback when API is unavailable ──
async function offlineFallback(query: string, words: Word[]): Promise<string> {
  await new Promise((r) => setTimeout(r, 300));

  const q = query.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|你好|nǐ hǎo)/i.test(q)) {
    const greetings = [
      `你好！Nice to see you! 今天想学点什么？(What do you want to learn today?) Fun fact: 你好 literally means "you good" — Chinese is pretty logical, right?`,
      `嘿！Hey there! 你好 (nǐ hǎo)! Ready to learn some Chinese? Tell me a word you're curious about, or I can pick something fun for you.`,
      `你好呀！Welcome back! 你知道吗 — just saying "谢谢" (xièxie, thank you) already makes you sound polite in Chinese. What are you working on?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Specific word lookup
  let targetWord: Word | null = null;
  const chineseMatch = query.match(/[\u4e00-\u9fff]+/);
  if (chineseMatch) {
    targetWord = words.find((w) => w.chinese === chineseMatch[0]) || null;
  }
  if (!targetWord) {
    const englishMatch = query.match(/'([^']+)'/) || query.match(/"([^"]+)"/);
    if (englishMatch) {
      const term = englishMatch[1].toLowerCase();
      targetWord =
        words.find((w) => w.english.toLowerCase().includes(term)) || null;
    }
  }

  if (targetWord) {
    return `**${targetWord.chinese}** (${targetWord.pinyin}) — ${targetWord.english} · HSK ${targetWord.hsk_level}`;
  }

  // Level-specific queries
  const levelMatch = q.match(/hsk\s*([1-4])/);
  if (levelMatch) {
    const level = parseInt(levelMatch[1]);
    const levelWords = words.filter((w) => w.hsk_level === level);
    if (levelWords.length > 0) {
      const shuffled = [...levelWords].sort(() => Math.random() - 0.5);
      const list = shuffled
        .slice(0, 5)
        .map((w) => `  - **${w.chinese}** (${w.pinyin}): ${w.english}`)
        .join("\n");
      return `Here are some HSK ${level} words I found:\n\n${list}\n\n(${levelWords.length} total words in HSK ${level})`;
    }
  }

  // Quiz requests
  if (q.includes("quiz") || q.includes("practice") || q.includes("test")) {
    if (words.length >= 4) {
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      const correct = shuffled[0];
      const options = shuffled.slice(0, 4).sort(() => Math.random() - 0.5);
      const optionList = options
        .map((w, i) => `${String.fromCharCode(65 + i)}) ${w.english}`)
        .join("\n");
      return `**Quick Quiz!**\n\nWhat does **${correct.chinese}** (${correct.pinyin}) mean?\n\n${optionList}\n\nReply with A, B, C, or D!`;
    }
  }

  // General fallback
  if (words.length > 0) {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    const list = shuffled
      .slice(0, 5)
      .map((w) => `  - **${w.chinese}** (${w.pinyin}): ${w.english}`)
      .join("\n");
    return `Some words from the HSK vocabulary:\n\n${list}\n\n(I'm offline — for better answers try going online!)`;
  }

  return `I'm offline right now so my responses are limited. But I'll be back to full power once the connection is restored. In the meantime, try asking about a specific HSK word!`;
}

// ── Session helpers (through DataSource) ──
export function listChatSessions(ds: DataSource) {
  return ds.chat.listSessions();
}
export function getChatSession(ds: DataSource, id: string) {
  return ds.chat.getSession(id);
}
export function saveChatSession(
  ds: DataSource,
  session: Parameters<DataSource["chat"]["saveSession"]>[0],
) {
  return ds.chat.saveSession(session);
}
export function deleteChatSession(ds: DataSource, id: string) {
  return ds.chat.deleteSession(id);
}
