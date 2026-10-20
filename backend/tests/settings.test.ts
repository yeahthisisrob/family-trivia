vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { aiTask, estimateMonthly, modelInfo } from '@family-trivia/shared';
import { loadModelChoices, modelFor } from '../services/bedrock/core/models';
import { flushUsage, recordUsage, usageKey } from '../services/bedrock/core/usage';
import { resolveSettings, saveSettings } from '../services/settings';
import { getStored, resetS3Mock } from './helpers/s3Mock';

beforeEach(() => resetS3Mock());

describe('settings', () => {
  test('saved beats environment beats default, and says which', async () => {
    process.env.TEST_FEATURE = 'false';
    expect((await resolveSettings()).find((s) => s.key === 'features.photos')).toMatchObject({
      value: true,
      source: 'default',
    });
    expect(await saveSettings({ 'features.photos': false })).toEqual([]);
    expect((await resolveSettings()).find((s) => s.key === 'features.photos')).toMatchObject({
      value: false,
      source: 'stored',
    });
    expect(await saveSettings({ 'features.photos': null })).toEqual([]);
    expect((await resolveSettings()).find((s) => s.key === 'features.photos')?.source).toBe(
      'default',
    );
  });

  test('bad values are explained and nothing is saved', async () => {
    const problems = await saveSettings({ 'features.photos': 'yes', 'nope.thing': true });
    expect(problems).toHaveLength(2);
    expect(getStored('config/settings.json')).toBeUndefined();
  });
});

describe('models per task', () => {
  test('a picked model wins; otherwise the task role default', async () => {
    await saveSettings({ 'ai.model.spotlight': 'us.anthropic.claude-opus-4-5-20251101-v1:0' });
    await loadModelChoices();
    expect(modelFor('spotlight')).toBe('us.anthropic.claude-opus-4-5-20251101-v1:0');
    expect(modelFor('roast')).toContain('haiku');
    expect(modelFor('trivia')).toContain('sonnet');
  });
});

describe('usage', () => {
  test('tallies tokens per task and model', async () => {
    recordUsage('trivia', 'm1', 1200, 300);
    recordUsage('trivia', 'm1', 800, 100);
    await flushUsage();
    expect(getStored<Record<string, Record<string, unknown>>>(usageKey())?.trivia?.m1).toEqual({
      calls: 2,
      input: 2000,
      output: 400,
    });
  });

  test('monthly estimate scales with the family', () => {
    const task = aiTask('trivia');
    const model = modelInfo('us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    expect(task && estimateMonthly(task, model, 10)).toBeCloseTo(
      (1.5 * 10 * 30 * (2500 * 3 + 500 * 15)) / 1e6,
      4,
    );
  });
});
