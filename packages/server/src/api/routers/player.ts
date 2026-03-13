import { router, publicProcedure, z } from '../trpc';
import type { PlayerService } from '../../application/player/PlayerService';
import type { PlayerInfo } from '@vt/shared/types';

export interface PlayerRouterDeps {
  playerService: PlayerService;
}

export const createPlayerRouter = (deps: PlayerRouterDeps) => {
  const joinSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(32),
    roomId: z.string().optional(),
  });

  const leaveSchema = z.object({
    playerId: z.string(),
    roomId: z.string(),
  });

  const listSchema = z.object({
    roomId: z.string(),
  });

  return router({
    join: publicProcedure
      .input(joinSchema)
      .mutation(async ({ input }): Promise<PlayerInfo> => {
        const player: PlayerInfo = {
          id: input.id,
          name: input.name,
          joinedAt: Date.now(),
        };

        const result = await deps.playerService.join(player);
        if (!result.success || !result.player) {
          throw new Error(result.error ?? 'Failed to join');
        }

        return result.player;
      }),

    leave: publicProcedure
      .input(leaveSchema)
      .mutation(async ({ input }): Promise<void> => {
        const result = await deps.playerService.leave(input.playerId, input.roomId);
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to leave');
        }
      }),

    list: publicProcedure
      .input(listSchema)
      .query(async ({ input }): Promise<PlayerInfo[]> => {
        return deps.playerService.listPlayers(input.roomId);
      }),
  });
};

export type PlayerRouter = ReturnType<typeof createPlayerRouter>;
