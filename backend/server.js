// ================================================================
// HSK Backend Proxy
// ----------------------------------------------------------------
// All sensitive API keys live here, server-side only.
// Both web and mobile apps call this backend instead of DeepSeek
// directly. The API key is NEVER exposed to any client.
// ================================================================

import "dotenv/config";
import express from "express";
import cors from "cors";

// ── Load server-side env (never bundled into client) ──
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const PORT = parseInt(process.env.PORT || "3000", 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();

// ── CORS ──
app.use(
  cors({
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : "*",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "100kb" }));

// ── Health check ──
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ── AI Chat proxy (keeps DeepSeek key server-side) ──
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    if (!DEEPSEEK_API_KEY) {
      console.error("[AI Proxy] DEEPSEEK_API_KEY not configured");
      return res.status(500).json({
        error:
          "AI service not configured. Set DEEPSEEK_API_KEY in backend/.env",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages,
        stream: false,
        temperature: temperature ?? 0.5,
        max_tokens: max_tokens ?? 512,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(
        `[AI Proxy] DeepSeek error ${response.status}:`,
        errText.slice(0, 200),
      );
      return res.status(response.status).json({
        error: `DeepSeek API returned ${response.status}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      return res.status(504).json({ error: "Request timed out" });
    }
    console.error("[AI Proxy] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`[HSK Backend] Running on http://localhost:${PORT}`);
  console.log(
    `[HSK Backend] AI proxy: POST http://localhost:${PORT}/api/ai/chat`,
  );
  if (!DEEPSEEK_API_KEY) {
    console.warn(
      "[HSK Backend] WARNING: DEEPSEEK_API_KEY not set in backend/.env",
    );
  }
});
