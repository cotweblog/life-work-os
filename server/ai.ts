import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("missing_api_key");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export async function chat(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system,
    messages,
  });
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}
