import City from '@civ-clone/core-city/City';
import Player from '@civ-clone/core-player/Player';
import Rule from '@civ-clone/core-rule/Rule';

// Whether taking this city starts a civil war: the city, who took it, and who held it (`lib/civilWar` `breaksOut`).
//  At least one rule must be registered, and every one must agree.
export class CivilWar extends Rule<[City, Player, Player], boolean> {}

export default CivilWar;
