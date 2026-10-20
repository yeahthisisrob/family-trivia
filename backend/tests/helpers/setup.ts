/**
 * Tests call handlers and services directly, outside a request, so work
 * with no circle set runs in a root circle, the shape of a deployment
 * before circles. Circle tests set their own with inCircle.
 *
 * Every handler the router serves is wrapped so its responses are checked
 * against the OpenAPI contract (helpers/contract.ts); in strict mode drift
 * fails the test that produced it.
 */
import type { APIGatewayProxyResult } from 'aws-lambda';
import { setFallbackScope } from '../../services/scope';
import { checkResponse, takeDrift } from './contract';
import { routeTable } from './routeTable';

setFallbackScope({ circleId: 'home', root: true });

type Handler = (...args: unknown[]) => Promise<APIGatewayProxyResult>;

const routesByModule = new Map<string, Map<string, string[]>>();
for (const { key, module, exportName } of routeTable()) {
  const byExport = routesByModule.get(module) ?? new Map<string, string[]>();
  byExport.set(exportName, [...(byExport.get(exportName) ?? []), key]);
  routesByModule.set(module, byExport);
}

for (const [module, byExport] of routesByModule) {
  vi.doMock(module, async (importOriginal) => {
    const original = await importOriginal<Record<string, unknown>>();
    const wrapped: Record<string, unknown> = { ...original };
    for (const [name, keys] of byExport) {
      const handler = original[name];
      if (typeof handler !== 'function') continue;
      wrapped[name] = async (...args: unknown[]) => {
        const response = await (handler as Handler)(...args);
        checkResponse(keys, response);
        return response;
      };
    }
    return wrapped;
  });
}

afterEach(() => {
  const drift = takeDrift();
  if (drift.length > 0) {
    throw new Error(`A response does not fit the OpenAPI contract:\n${drift.join('\n')}`);
  }
});
