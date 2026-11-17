import { AddPlayerGame } from '@civ-clone/base-player/lib/addPlayer';
import City from '@civ-clone/core-city/City';
import Civilization from '@civ-clone/core-civilization/Civilization';
import { Game } from '@civ-clone/core-game';
import Leader from '@civ-clone/core-civilization/Leader';
import Player from '@civ-clone/core-player/Player';
import { RuleRegistry } from '@civ-clone/core-rule/RuleRegistry';
import Unit from '@civ-clone/core-unit/Unit';
export type CivilWarGame = AddPlayerGame &
  Pick<Game, 'cities' | 'playerResearch' | 'units'>;
export type CivilWarOptions = {
  /** The ids of rules held off while the rebels join (`addPlayerHoldingOff`), such as the ruleset's starting advances. */
  heldOff?: string[];
  /** The rebels' civilization and leader, from those not yet taken. Left out, `addPlayer` draws them. */
  civilization?: typeof Civilization;
  leader?: typeof Leader;
};
/** Whether taking `city` from `loser` starts a civil war: at least one `CivilWar` rule, and every one agrees. */
export declare const breaksOut: (
  city: City,
  captor: Player,
  loser: Player,
  ruleRegistry: RuleRegistry
) => boolean;
/**
 * The cities that join the rebels: every `RebelCities` rule's, once each, in the order the rules give them, leaving out
 * any that is destroyed, `lost`, or no longer `loser`'s.
 */
export declare const rebelCities: (
  loser: Player,
  lost: City,
  ruleRegistry: RuleRegistry
) => City[];
/**
 * The units that go with the rebels' cities, and the city each is to be homed in (or `null`), as the original moves
 * them: all of the loser's units on a square with a rebel city go; on a square with no city, all of them go if any is
 * homed in a rebel city. A unit homed in a rebel city keeps it; one homed elsewhere is rehomed in the city that took
 * it, or in its stack's first rebel home; one with no home keeps none.
 */
export declare const rebelUnits: (
  game: Pick<CivilWarGame, 'cities' | 'units'>,
  loser: Player,
  cities: City[]
) => [Unit, City | null][];
/**
 * A civil war: `loser` splits, and a new civilization of rebels takes the cities the `RebelCities` rules choose, for a
 * ruleset's `Captured` rule to call when `breaksOut` says so. In order:
 *
 * 1. with no civilization left for the rebels to play, or no city for them, nothing happens and it returns `null`;
 * 2. the rebels join (`addPlayerHoldingOff`), on `lost`'s world;
 * 3. they know everything `loser` knows;
 * 4. their cities change hands as they are (`City#transfer`): no `Captured` rule runs, so each keeps its buildings,
 *    its production and its people;
 * 5. the units that go with them change hands (`Unit#transfer`, `rebelUnits`);
 * 6. the `Seceded` rules run, for the ruleset's share of the rest;
 * 7. `player:civil-war` is emitted, with `loser`, the rebels and their cities.
 */
export declare const civilWar: (
  game: CivilWarGame,
  loser: Player,
  lost: City,
  { civilization, heldOff, leader }?: CivilWarOptions
) => Player | null;
export default civilWar;
