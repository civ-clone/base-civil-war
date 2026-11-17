import { AddPlayerGame } from '@civ-clone/base-player/lib/addPlayer';
import Advance from '@civ-clone/core-science/Advance';
import City from '@civ-clone/core-city/City';
import CivilWar from '../Rules/CivilWar';
import Civilization from '@civ-clone/core-civilization/Civilization';
import { Game } from '@civ-clone/core-game';
import Leader from '@civ-clone/core-civilization/Leader';
import Player from '@civ-clone/core-player/Player';
import RebelCities from '../Rules/RebelCities';
import { RuleRegistry } from '@civ-clone/core-rule/RuleRegistry';
import Seceded from '../Rules/Seceded';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
import addPlayerHoldingOff from '@civ-clone/base-game-end/lib/addPlayerHoldingOff';

// The parts of a game a civil war needs. A `Game` has them all.
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
export const breaksOut = (
  city: City,
  captor: Player,
  loser: Player,
  ruleRegistry: RuleRegistry
): boolean => {
  const answers = ruleRegistry.process(CivilWar, city, captor, loser);

  return (
    answers.length > 0 && answers.every((answer: boolean): boolean => answer)
  );
};

/**
 * The cities that join the rebels: every `RebelCities` rule's, once each, in the order the rules give them, leaving out
 * any that is destroyed, `lost`, or no longer `loser`'s.
 */
export const rebelCities = (
  loser: Player,
  lost: City,
  ruleRegistry: RuleRegistry
): City[] => [
  ...new Set(
    ruleRegistry
      .process(RebelCities, loser, lost)
      .flat()
      .filter(
        (city: City): boolean =>
          city !== lost && !city.destroyed() && city.player() === loser
      )
  ),
];

/**
 * The units that go with the rebels' cities, and the city each is to be homed in (or `null`), as the original moves
 * them: all of the loser's units on a square with a rebel city go; on a square with no city, all of them go if any is
 * homed in a rebel city. A unit homed in a rebel city keeps it; one homed elsewhere is rehomed in the city that took
 * it, or in its stack's first rebel home; one with no home keeps none.
 */
export const rebelUnits = (
  game: Pick<CivilWarGame, 'cities' | 'units'>,
  loser: Player,
  cities: City[]
): [Unit, City | null][] => {
  const rebel = new Set<City>(cities),
    stacks = new Map<Tile, Unit[]>();

  game.units.getByPlayer(loser).forEach((unit: Unit): void => {
    const stack = stacks.get(unit.tile()) ?? [];

    stack.push(unit);
    stacks.set(unit.tile(), stack);
  });

  return [...stacks.entries()].flatMap(
    ([tile, units]): [Unit, City | null][] => {
      const cityHere = game.cities.getByTile(tile),
        home =
          cityHere !== null
            ? rebel.has(cityHere)
              ? cityHere
              : null
            : units
                .map((unit: Unit): City | null => unit.city() as City | null)
                .find(
                  (city: City | null): boolean =>
                    city !== null && rebel.has(city)
                ) ?? null;

      if (home === null) {
        return [];
      }

      return units.map((unit: Unit): [Unit, City | null] => {
        const unitHome = unit.city() as City | null;

        return [
          unit,
          unitHome === null ? null : rebel.has(unitHome) ? unitHome : home,
        ];
      });
    }
  );
};

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
export const civilWar = (
  game: CivilWarGame,
  loser: Player,
  lost: City,
  { civilization, heldOff = [], leader }: CivilWarOptions = {}
): Player | null => {
  if (game.civilizations.entries().length === 0) {
    return null;
  }

  const cities = rebelCities(loser, lost, game.rules);

  if (cities.length === 0) {
    return null;
  }

  const rebels = addPlayerHoldingOff(game, lost.tile().map(), heldOff, {
      civilization,
      leader,
    }),
    research = game.playerResearch.getByPlayer(rebels);

  game.playerResearch
    .getByPlayer(loser)
    .complete()
    .forEach((advance: Advance): void =>
      research.addAdvance(advance.sourceClass<typeof Advance>())
    );

  // Who goes with them is decided before any city changes hands.
  const units = rebelUnits(game, loser, cities);

  cities.forEach((city: City): void => city.transfer(rebels));

  units.forEach(([unit, home]): void => unit.transfer(rebels, home));

  game.rules.process(Seceded, rebels, loser, cities);

  game.engine.emit('player:civil-war', loser, rebels, cities);

  return rebels;
};

export default civilWar;
