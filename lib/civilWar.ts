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

/** A unit the split changes: whether it goes to the rebels, and the city it is homed in after (or `null`). */
export type SplitUnit = [unit: Unit, toRebels: boolean, home: City | null];

/**
 * What happens to the loser's units, as the original moves them. In `units.getByPlayer` order, each unit not yet
 * settled is decided by the city on its square or, with none there, by its home city (a unit with neither is left as
 * it is). If that city is a rebel city, the unit's whole stack (the loser's units on its square) goes to the rebels;
 * if it is one of the loser's other cities, the stack stays. Either way, a unit in the stack homed in a city of the
 * other side is rehomed in the deciding city, so every home stays its owner's. So the first unit of a stack at large
 * with a home decides for the stack.
 *
 * Only the units that change are listed: those that go, and those that stay but are rehomed.
 */
export const splitUnits = (
  game: Pick<CivilWarGame, 'cities' | 'units'>,
  loser: Player,
  cities: City[]
): SplitUnit[] => {
  const rebel = new Set<City>(cities),
    units = game.units.getByPlayer(loser),
    settled = new Set<Unit>(),
    changes: SplitUnit[] = [],
    sideOf = (city: City | null): 'rebel' | 'loyal' | null =>
      city === null
        ? null
        : rebel.has(city)
        ? 'rebel'
        : city.player() === loser
        ? 'loyal'
        : null;

  units.forEach((unit: Unit): void => {
    if (settled.has(unit)) {
      return;
    }

    const deciding =
        game.cities.getByTile(unit.tile()) ?? (unit.city() as City | null),
      side = sideOf(deciding);

    if (side === null) {
      return;
    }

    units
      .filter((other: Unit): boolean => other.tile() === unit.tile())
      .forEach((member: Unit): void => {
        settled.add(member);

        const home = member.city() as City | null,
          newHome = home === null || sideOf(home) === side ? home : deciding;

        if (side === 'rebel' || newHome !== home) {
          changes.push([member, side === 'rebel', newHome]);
        }
      });
  });

  return changes;
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
 * 5. the units that go with them change hands (`Unit#transfer`), and any left homed on the wrong side are rehomed
 *    (`splitUnits`);
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
  const units = splitUnits(game, loser, cities);

  cities.forEach((city: City): void => city.transfer(rebels));

  units.forEach(([unit, toRebels, home]): void => {
    if (toRebels) {
      unit.transfer(rebels, home);

      return;
    }

    unit.setCity(home as City);
  });

  game.rules.process(Seceded, rebels, loser, cities);

  game.engine.emit('player:civil-war', loser, rebels, cities);

  return rebels;
};

export default civilWar;
