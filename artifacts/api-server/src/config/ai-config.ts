// Default models per provider (all support OpenAI-compatible chat API)
export const AI_MODELS_BY_PROVIDER: Record<string, string> = {
    openai:   "gpt-4o-mini",
    gemini:   "gemini-1.5-flash",
    claude:   "claude-3-haiku-20240307",
    deepseek: "deepseek-chat",
    ollama:   "llama3",
};

export const AI_MODELS = {
    CHAT:       "gpt-4o-mini",
    GENERATE:   "gpt-4o-mini",
    GENERAL:    "gpt-4o-mini",
    WEB_SEARCH: "gpt-4o-mini",
} as const;
