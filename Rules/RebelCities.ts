import City from '@civ-clone/core-city/City';
import Player from '@civ-clone/core-player/Player';
import Rule from '@civ-clone/core-rule/Rule';

// Which of a civilization's cities join the rebels in a civil war: the civilization, and the city whose loss started
//  it (`lib/civilWar` `rebelCities`). Every rule's cities go.
export class RebelCities extends Rule<[Player, City], City[]> {}

export default RebelCities;
