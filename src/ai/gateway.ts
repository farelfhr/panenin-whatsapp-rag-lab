import type { Type } from "@google/genai";

export interface StructuredSchema {
  type: Type;
  properties: Record<string, unknown>;
  required: string[];
}

export interface TextGenerationGateway {
  generateText(input: {
    prompt: string;
    systemInstruction?: string;
    responseSchema?: StructuredSchema;
  }): Promise<string>;
}

export interface EmbeddingGateway {
  embedText(input: {
    text: string;
    outputDimensionality: number;
  }): Promise<number[]>;
}
