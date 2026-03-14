import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createTRPCRouter = router;

export type AppRouter = typeof router;

export { z };
