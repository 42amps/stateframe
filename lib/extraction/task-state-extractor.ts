import { randomUUID } from "node:crypto";

import { z } from "zod";

import { StateItemTypeSchema } from "../domain/task-state-ledger";
import { buildExtractionPrompt } from "./extraction-prompt";
import { createGeminiProvider } from "./providers/gemini-provider";
import { createOllamaProvider } from "./providers/ollama-provider";
import { createOpenRouterProvider } from "./providers/openrouter-provider";
import {
  type ExtractionProvider,
  type ExtractionProviderName,
} from "./providers/types";

export const CandidateStateItemSchema = z.object({
  client_id: z.string().min(1),
  type: StateItemTypeSchema,
  content: z.string().min(1),
  rationale: z.string().min(1).nullable(),
  confidence: z.number().min(0.5).max(1),
  provenance: z.string().min(1),
});

export type CandidateStateItem = z.infer<typeof CandidateStateItemSchema>;

export const ExtractionResultSchema = z.object({
  session_summary: z.string().min(1),
  requested_next_action: z.string().min(1).nullable(),
  items: z.array(CandidateStateItemSchema),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const ExtractionProviderNameSchema = z.enum([
  "gemini",
  "openrouter",
  "ollama",
]);

export const ExtractTaskStateInputSchema = z.object({
  transcript: z.string().min(1),
  sessionTool: z.string().min(1).nullable().default(null),
  provider: ExtractionProviderNameSchema,
  model: z.string().min(1).nullable().optional(),
});

export type ExtractTaskStateInput = z.input<
  typeof ExtractTaskStateInputSchema
>;

const NullableNonEmptyStringSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.string().min(1).nullable(),
);

const RawCandidateStateItemSchema = CandidateStateItemSchema.omit({
  client_id: true,
  confidence: true,
  rationale: true,
}).extend({
  client_id: z.string().min(1).optional(),
  rationale: NullableNonEmptyStringSchema,
  confidence: z.coerce.number().min(0.5).max(1),
});

const RawExtractionResultSchema = z.object({
  session_summary: z.string().min(1),
  requested_next_action: NullableNonEmptyStringSchema,
  items: z.array(RawCandidateStateItemSchema),
});

export async function extractTaskStateFromTranscript(
  input: ExtractTaskStateInput,
): Promise<ExtractionResult> {
  const parsedInput = ExtractTaskStateInputSchema.parse(input);
  const prompt = buildExtractionPrompt({
    transcript: parsedInput.transcript,
    sessionTool: parsedInput.sessionTool,
  });
  const provider = createExtractionProvider(
    parsedInput.provider,
    parsedInput.model,
  );
  const rawOutput = await provider.extractJson(prompt);
  return parseExtractionResultFromModelOutput(rawOutput);
}

export function parseExtractionResultFromModelOutput(
  rawOutput: string,
): ExtractionResult {
  const json = parseModelJson(rawOutput);
  const parsedOutput = RawExtractionResultSchema.parse(json);

  return ExtractionResultSchema.parse({
    ...parsedOutput,
    items: parsedOutput.items.map((item) => ({
      ...item,
      client_id: item.client_id ?? randomUUID(),
      confidence: normalizeConfidence(item.confidence),
    })),
  });
}

export function createExtractionProvider(
  provider: ExtractionProviderName,
  model?: string | null,
): ExtractionProvider {
  if (provider === "gemini") {
    return createGeminiProvider({ model });
  }

  if (provider === "openrouter") {
    return createOpenRouterProvider({ model });
  }

  return createOllamaProvider({ model });
}

export function parseModelJson(rawOutput: string): unknown {
  const trimmed = rawOutput.trim();
  const direct = tryParseJson(trimmed);

  if (direct.ok) {
    return direct.value;
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fenced) {
    const parsedFence = tryParseJson(fenced[1].trim());

    if (parsedFence.ok) {
      return parsedFence.value;
    }
  }

  const embeddedObject = findFirstJsonObject(trimmed);

  if (embeddedObject) {
    const parsedEmbedded = tryParseJson(embeddedObject);

    if (parsedEmbedded.ok) {
      return parsedEmbedded.value;
    }
  }

  throw new Error(`Model output was not valid JSON: ${direct.error.message}`);
}

function tryParseJson(
  value: string,
): { ok: true; value: unknown } | { ok: false; error: SyntaxError } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch (error) {
    return { ok: false, error: error as SyntaxError };
  }
}

function normalizeConfidence(confidence: number): number {
  return confidence >= 1 ? 0.95 : confidence;
}

function findFirstJsonObject(value: string): string | null {
  const start = value.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}
