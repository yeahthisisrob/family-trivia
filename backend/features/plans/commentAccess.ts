/** An event's comments are for the people it's for (docs/decisions/0036). */
import { guardComments } from '../../services/commentsService';
import { maySee } from './events';

guardComments('event', async (id, userId) => !!(await maySee(id, userId)));
