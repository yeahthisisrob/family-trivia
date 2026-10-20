vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import {
  AiOutputInvalid,
  askStructured,
  askText,
  setBedrockClient,
  unlessInvalid,
} from '../services/bedrock/core/converse';
import { flushUsage, usageKey } from '../services/bedrock/core/usage';
import { calls, fakeBedrock as fake, says } from './helpers/fakeBedrock';
import { getStored, resetS3Mock } from './helpers/s3Mock';

const HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

interface Fact {
  fact: string;
}
const isFact = (v: unknown): v is Fact =>
  typeof (v as Fact | null)?.fact === 'string' && (v as Fact).fact.length > 0;
const factAsk = {
  task: 'funFact',
  model: HAIKU,
  prompt: 'A fun fact about pizza.',
  name: 'give_fact',
  description: 'The fun fact',
  schema: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] },
  check: isFact,
};

beforeEach(() => resetS3Mock());
afterEach(() => setBedrockClient(null));

describe('talking to the model (0033)', () => {
  test('askText returns the words and counts the tokens', async () => {
    const sent = fake(says('  Hello there. '));
    expect(await askText({ task: 'roast', prompt: 'Hi', model: HAIKU })).toBe('Hello there.');
    expect(sent[0]?.messages?.[0]?.content).toEqual([{ text: 'Hi' }]);
    await flushUsage();
    expect(getStored<Record<string, Record<string, unknown>>>(usageKey())?.roast?.[HAIKU]).toEqual({
      calls: 1,
      input: 100,
      output: 20,
    });
  });

  test('a long system prompt is cached; a short one is not', async () => {
    const sent = fake(says('a'), says('b'));
    await askText({ task: 'x', prompt: 'p', system: 'Rules. '.repeat(1000), model: HAIKU });
    await askText({ task: 'x', prompt: 'p', system: 'Short rules.', model: HAIKU });
    expect(sent[0]?.system?.[1]).toEqual({ cachePoint: { type: 'default' } });
    expect(sent[1]?.system).toHaveLength(1);
  });

  test('askStructured forces the tool and returns its checked input', async () => {
    const sent = fake(calls('give_fact', { fact: 'Pizza is old.' }));
    expect(await askStructured(factAsk)).toEqual({ fact: 'Pizza is old.' });
    expect(sent[0]?.toolConfig?.toolChoice).toEqual({ tool: { name: 'give_fact' } });
  });

  test('a wrong shape is sent back once with what was wrong, then accepted', async () => {
    const sent = fake(
      calls('give_fact', { fact: '' }),
      calls('give_fact', { fact: 'Pizza is old.' }),
    );
    expect(await askStructured({ ...factAsk, why: () => 'fact was empty' })).toEqual({
      fact: 'Pizza is old.',
    });
    const retry = sent[1]?.messages ?? [];
    expect(retry).toHaveLength(3);
    expect(JSON.stringify(retry[2])).toContain('fact was empty');
  });

  test('still wrong after one retry: refused, never passed on', async () => {
    fake(calls('give_fact', { nope: 1 }), says('I would rather chat.'));
    await expect(askStructured(factAsk)).rejects.toBeInstanceOf(AiOutputInvalid);
  });

  test('unlessInvalid: a refused answer becomes the fallback; other errors still throw', async () => {
    fake(calls('give_fact', { nope: 1 }), calls('give_fact', { nope: 2 }));
    expect(await unlessInvalid(askStructured(factAsk), 'none')).toBe('none');
    await expect(unlessInvalid(Promise.reject(new Error('down')), 'none')).rejects.toThrow('down');
  });
});
