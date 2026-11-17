import City from '@civ-clone/core-city/City';
import Player from '@civ-clone/core-player/Player';
import Rule from '@civ-clone/core-rule/Rule';

// After a civil war's split (`lib/civilWar`): the rebels, the civilization they left, and the cities they took. For a
//  ruleset's share of the rest: gold, government, what the map shows, treaties, a new capital.
export class Seceded extends Rule<[Player, Player, City[]], void> {}

export default Seceded;
