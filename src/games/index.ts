import { createRegistry } from '../carnival';
import { ringToss } from './ring-toss/game';
import { waterCannon } from './water-cannon/game';
import { whackAMole } from './whack-a-mole/game';

/** Every game on the midway. A new game is added to this list. */
export const registry = createRegistry([waterCannon, ringToss, whackAMole]);
