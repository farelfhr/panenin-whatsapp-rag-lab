import type { EmbeddingGateway } from "./gateway.js";

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
}

export class GeminiEmbeddingService implements EmbeddingService {
  public constructor(
    private readonly gateway: EmbeddingGateway,
    private readonly dimension: number,
  ) {}

  public async embed(text: string): Promise<number[]> {
    const vector = await this.gateway.embedText({
      text,
      outputDimensionality: this.dimension,
    });
    if (vector.length !== this.dimension) {
      throw new Error(
        `Dimensi embedding tidak sesuai: expected ${this.dimension}, received ${vector.length}`,
      );
    }
    if (vector.some((value) => !Number.isFinite(value))) {
      throw new Error("Embedding mengandung nilai bukan angka valid");
    }
    return vector;
  }
}
