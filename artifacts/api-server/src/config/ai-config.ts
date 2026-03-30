// Default models per provider (all support OpenAI-compatible chat API)
export const AI_MODELS_BY_PROVIDER: Record<string, string> = {
        openai: "gpt-4o-mini",
        gemini: "gemini-2.0-flash",
        claude: "claude-3-haiku-20240307",
        deepseek: "deepseek-chat",
        ollama: "llama3",
};

// Dynamic model resolver - reads active provider from DB config at runtime
// Falls back to env var AI_PROVIDER or defaults to openai
export function getModelForProvider(provider?: string): string {
        const p = (provider || process.env.AI_PROVIDER || "openai").toLowerCase();
        return AI_MODELS_BY_PROVIDER[p] || AI_MODELS_BY_PROVIDER["openai"];
}

// Static defaults used as fallback when DB config is not yet loaded
export const AI_MODELS = {
        CHAT: "gemini-2.0-flash",
        GENERATE: "gemini-2.0-flash",
        GENERAL: "gemini-2.0-flash",
        WEB_SEARCH: "gemini-2.0-flash",
} as const;
