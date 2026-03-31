import OpenAI from "openai";
import { db as dbInstance, sql as dSql } from "../../../../lib/db/src/index.js";
const db: any = dbInstance;
const sql: any = dSql;

// Default base URLs per provider
const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; defaultModel: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  claude: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  together: {
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3",
  },
};

export interface AIConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

let cachedConfig: AIConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

/** Get the active AI configuration from DB, falling back to env vars */
export async function getActiveAIConfig(): Promise<AIConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  let provider = "openai";
  let apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
  let baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "";

  try {
    const result = await db.execute(sql`SELECT * FROM ai_configurations WHERE is_active = true LIMIT 1`);
    const row = result.rows[0];
    if (row) {
      provider = row.provider || "openai";
      apiKey = row.api_key || apiKey;
      baseUrl = row.base_url || baseUrl;
    }
  } catch {
    // DB not available, use env vars
  }

  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
  if (!baseUrl) baseUrl = defaults.baseUrl;
  const model = defaults.defaultModel;

  cachedConfig = { provider, apiKey, baseUrl, model };
  cacheTime = now;
  return cachedConfig;
}

/** Clear the config cache (call after settings change) */
export function clearAIConfigCache() {
  cachedConfig = null;
  cacheTime = 0;
}

/** Get an OpenAI-compatible client configured with the active provider */
export async function getAIClient(): Promise<OpenAI> {
  const config = await getActiveAIConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
}

/** Get the model name to use */
export async function getModel(): Promise<string> {
  const config = await getActiveAIConfig();
  return config.model;
}

/**
 * Universal AI chat call — handles parameter differences between providers.
 * Use this instead of calling client.chat.completions.create directly.
 */
export async function aiChat(opts: {
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  stream?: false;
}): Promise<string> {
  const config = await getActiveAIConfig();
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });

  // Build params compatible with ALL providers
  const params: any = {
    model: config.model,
    messages: opts.messages,
  };

  // Token limit — different providers use different parameter names
  if (opts.maxTokens) {
    if (config.provider === "gemini") {
      // Gemini only supports max_tokens, not max_completion_tokens
      params.max_tokens = opts.maxTokens;
    } else {
      // OpenAI, DeepSeek, Groq, Together, OpenRouter all support this
      params.max_completion_tokens = opts.maxTokens;
    }
  }

  try {
    const res = await client.chat.completions.create(params);
    return res.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error(`[AI ${config.provider}] Chat error:`, err);
    // If max_completion_tokens failed, retry with max_tokens as fallback
    if (params.max_completion_tokens) {
      try {
        delete params.max_completion_tokens;
        params.max_tokens = opts.maxTokens;
        const res = await client.chat.completions.create(params);
        return res.choices[0]?.message?.content ?? "";
      } catch (retryErr) {
        console.error(`[AI ${config.provider}] Retry with max_tokens also failed:`, retryErr);
      }
    }
    throw err;
  }
}

/**
 * Universal AI streaming chat — for SSE endpoints like /chat
 */
export async function aiChatStream(opts: {
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
}): Promise<AsyncIterable<any>> {
  const config = await getActiveAIConfig();
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });

  const params: any = {
    model: config.model,
    messages: opts.messages,
    stream: true,
  };

  if (opts.maxTokens) {
    if (config.provider === "gemini") {
      params.max_tokens = opts.maxTokens;
    } else {
      params.max_completion_tokens = opts.maxTokens;
    }
  }

  try {
    return await client.chat.completions.create(params);
  } catch (err) {
    // Fallback: retry with max_tokens
    if (params.max_completion_tokens) {
      delete params.max_completion_tokens;
      params.max_tokens = opts.maxTokens;
      return await client.chat.completions.create(params);
    }
    throw err;
  }
}

// Legacy export for backward compatibility
export const AI_MODELS = {
  CHAT: "gpt-4o-mini",
  GENERATE: "gpt-4o-mini",
  GENERAL: "gpt-4o-mini",
  WEB_SEARCH: "gpt-4o-mini",
} as const;
