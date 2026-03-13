import { router, publicProcedure, z } from '../trpc';
import type { ShipService } from '../../application/ship/ShipService';
import type { ShipStatus } from '@vt/shared/types';

export interface ShipRouterDeps {
  shipService: ShipService;
}

const movementInputSchema = z.object({
  shipId: z.string(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
});

const toggleShieldInputSchema = z.object({
  shipId: z.string(),
});

const ventInputSchema = z.object({
  shipId: z.string(),
});

const getStatusInputSchema = z.object({
  shipId: z.string(),
});

export const createShipRouter = (deps: ShipRouterDeps) => {
  return router({
    move: publicProcedure
      .input(movementInputSchema)
      .mutation(async ({ input }): Promise<ShipStatus | null> => {
        const result = await deps.shipService.moveShip(input.shipId, {
          shipId: input.shipId,
          phase: input.phase,
          type: input.type,
          distance: input.distance,
          angle: input.angle,
        });

        if (!result.success) {
          throw new Error(result.error ?? 'Movement failed');
        }

        const status = deps.shipService.getShipStatus(input.shipId);
        return status ?? null;
      }),

    toggleShield: publicProcedure
      .input(toggleShieldInputSchema)
      .mutation(async ({ input }): Promise<ShipStatus | null> => {
        const success = await deps.shipService.toggleShield(input.shipId);
        if (!success) {
          throw new Error('Failed to toggle shield');
        }

        const status = deps.shipService.getShipStatus(input.shipId);
        return status ?? null;
      }),

    vent: publicProcedure
      .input(ventInputSchema)
      .mutation(async ({ input }): Promise<ShipStatus | null> => {
        const success = await deps.shipService.ventShip(input.shipId);
        if (!success) {
          throw new Error('Failed to vent');
        }

        const status = deps.shipService.getShipStatus(input.shipId);
        return status ?? null;
      }),

    getStatus: publicProcedure
      .input(getStatusInputSchema)
      .query(async ({ input }): Promise<ShipStatus | null> => {
        return deps.shipService.getShipStatus(input.shipId) ?? null;
      }),
  });
};

export type ShipRouter = ReturnType<typeof createShipRouter>;
