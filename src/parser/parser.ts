import Anthropic from "@anthropic-ai/sdk";
import { ParsedIntent } from "./types.js";
import { INTENT_EXTRACTION_PROMPT, buildUserPrompt } from "./prompts.js";

const FALLBACK_INTENT: ParsedIntent = {
  intent: "unknown",
  confidence: 0,
};

export async function parseMessage(
  messageText: string,
  currentDate: string,
  teamMembers: string[]
): Promise<ParsedIntent> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: INTENT_EXTRACTION_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(messageText, currentDate, teamMembers) }],
  });
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return FALLBACK_INTENT;
  try {
    return JSON.parse(textBlock.text) as ParsedIntent;
  } catch {
    return FALLBACK_INTENT;
  }
}
