export type ExtractionProviderName = "gemini" | "openrouter" | "ollama";

export type ExtractionProviderOptions = {
  model?: string | null;
};

export interface ExtractionProvider {
  name: ExtractionProviderName;
  extractJson(prompt: string): Promise<string>;
}

export class ExtractionProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionProviderConfigurationError";
  }
}

export class ExtractionProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ExtractionProviderName,
  ) {
    super(message);
    this.name = "ExtractionProviderError";
  }
}
