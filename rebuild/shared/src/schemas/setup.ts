import type { z } from 'zod';
import { createUserInput } from './users.js';

/** First-run owner account: same fields as a new user, the role is always ADMIN. */
export const setupInput = createUserInput.omit({ role: true });
export type SetupInput = z.infer<typeof setupInput>;
