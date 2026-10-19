/**
 * Tests call handlers and services directly, outside a request, so work
 * with no circle set runs in a root circle, the shape of a deployment
 * before circles. Circle tests set their own with inCircle.
 */
import { setFallbackScope } from '../../services/scope';

setFallbackScope({ circleId: 'home', root: true });
