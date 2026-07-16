export interface DeduplicationStore {
  claim(providerMessageId: string): Promise<boolean>;
}

export class InMemoryDeduplicationStore implements DeduplicationStore {
  private readonly seen = new Set<string>();

  public async claim(providerMessageId: string): Promise<boolean> {
    if (this.seen.has(providerMessageId)) return false;
    this.seen.add(providerMessageId);
    return true;
  }
}
