/** A stand-in Bedrock for tests: answers in turn, and keeps every request (0033). */
import type { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { setBedrockClient } from '../../services/bedrock/core/converse';

type Sent = ConverseCommand['input'];

/** Talk to `reply` instead of Bedrock: it answers each request. */
export function answerBedrock(reply: (request: Sent, n: number) => object): Sent[] {
  const sent: Sent[] = [];
  const client = {
    send: async (cmd: ConverseCommand) => {
      sent.push(cmd.input);
      return {
        usage: { inputTokens: 100, outputTokens: 20 },
        stopReason: 'end_turn',
        ...reply(cmd.input, sent.length - 1),
      };
    },
  };
  setBedrockClient(client as unknown as BedrockRuntimeClient);
  return sent;
}

/** Talk to these replies, in turn, instead of Bedrock; the last one repeats once they run out. */
export const fakeBedrock = (...replies: object[]): Sent[] =>
  answerBedrock((_, n) => replies[n] ?? replies.at(-1) ?? {});

/** A reply in words. */
export const says = (text: string) => ({
  output: { message: { role: 'assistant', content: [{ text }] } },
});

/** A reply that calls the tool `name` with `input`. */
export const calls = (name: string, input: unknown) => ({
  stopReason: 'tool_use',
  output: {
    message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't1', name, input } }] },
  },
});
