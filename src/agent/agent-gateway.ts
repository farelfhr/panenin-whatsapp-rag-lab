export interface AgentGateway {
  run(input: { internalUserId: string; message: string }): Promise<{ text: string }>;
}
