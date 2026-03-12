import { router } from '../trpc';
import { createPlayerRouter } from './player';
import { createShipRouter } from './ship';
import type { PlayerService } from '../../application/player/PlayerService';
import type { ShipService } from '../../application/ship/ShipService';

export interface AppRouterDeps {
  playerService: PlayerService;
  shipService: ShipService;
}

export const createAppRouter = (deps: AppRouterDeps) => {
  return router({
    player: createPlayerRouter({ playerService: deps.playerService }),
    ship: createShipRouter({ shipService: deps.shipService }),
  });
};

export type AppRouter = ReturnType<typeof createAppRouter>;
