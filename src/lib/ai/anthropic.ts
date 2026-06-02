import Anthropic from "@anthropic-ai/sdk";

// Real Claude API integration. The key is read from the environment so the app
// runs in template-only mode until a key is supplied (see isAiConfigured()).
const DEFAULT_MODEL = "claude-opus-4-8";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("The Claude API key (ANTHROPIC_API_KEY) is not configured.");
    this.name = "AiNotConfiguredError";
  }
}

export function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
    configured: Boolean(apiKey && apiKey.length > 0),
  };
}

export function isAiConfigured() {
  return getAnthropicConfig().configured;
}

let cachedClient: Anthropic | null = null;

function getClient(apiKey: string) {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

export type GenerateAuditTextOptions = {
  system: string;
  prompt: string;
  maxTokens?: number;
};

/**
 * Single-shot Claude generation for audit drafting tasks. The system prompt is
 * cached (stable across calls) and adaptive thinking is enabled for quality.
 * Throws AiNotConfiguredError when no API key is present so callers can fall
 * back to deterministic templates.
 */
export async function generateAuditText({ system, prompt, maxTokens = 8000 }: GenerateAuditTextOptions): Promise<string> {
  const { apiKey, model, configured } = getAnthropicConfig();

  if (!configured || !apiKey) {
    throw new AiNotConfiguredError();
  }

  const client = getClient(apiKey);
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });

  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
