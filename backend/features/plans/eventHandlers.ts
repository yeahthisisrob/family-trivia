/** Events (docs/decisions/0036): make, change, read, invite and download one. */
import { eventIcs, icsFileName } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS, errorResponse, successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { type Asker, audienceChoices, createEvent, eventView, maySee, updateEvent } from './events';
import { body } from './handlers';
import { eventsOn } from './store';

type Handler = (
  e: APIGatewayProxyEvent,
  me: string,
  caller: Caller,
) => Promise<APIGatewayProxyResult>;

/** Events are a feature a circle can turn off (Settings › Features › Events): then every route refuses. */
const whenOn =
  (handler: Handler): Handler =>
  async (e, me, caller) =>
    (await eventsOn()) ? handler(e, me, caller) : errorResponse('Events are turned off here', 403);

const asker = (me: string, caller: Caller): Asker => ({
  me,
  email: caller.email,
  circle: caller.circle,
});
const idIn = (e: APIGatewayProxyEvent) => e.queryStringParameters?.id ?? '';

/** GET /plans/events?id= */
export const getEvent = whenOn(async (e, me, caller) => {
  const event = await eventView(idIn(e), asker(me, caller));
  return event ? successResponse({ event }) : errorResponse('No such event', 404);
});

/** POST /plans/events { title, start, ... } */
export const postEvent = whenOn(async (e, me, caller) => {
  const made = await createEvent(body(e), asker(me, caller));
  return made.ok
    ? successResponse({ event: made.value }, 201)
    : errorResponse(made.error, made.status);
});

/** PUT /plans/events { id, title, start, ... } */
export const putEvent = whenOn(async (e, me, caller) => {
  const changed = await updateEvent(body(e), asker(me, caller));
  return changed.ok
    ? successResponse({ event: changed.value })
    : errorResponse(changed.error, changed.status);
});

/** GET /plans/events/audience */
export const getAudience = whenOn(async (_e, me, caller) =>
  successResponse({ circles: await audienceChoices(asker(me, caller)) }),
);

/** GET /plans/events/ics?id=: the calendar file, for any client with the person's token. */
export const getEventIcs = whenOn(async (e, me) => {
  const found = await maySee(idIn(e), me);
  if (!found) return errorResponse('No such event', 404);
  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFileName(found.drop)}"`,
    },
    body: eventIcs(found.drop),
  };
});
