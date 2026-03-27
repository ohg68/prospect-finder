import OpenAI from "openai";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing-key";
const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

export const openai = new OpenAI({
  apiKey,
  baseURL,
});
