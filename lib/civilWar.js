"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.civilWar = exports.rebelUnits = exports.rebelCities = exports.breaksOut = void 0;
const CivilWar_1 = require("../Rules/CivilWar");
const RebelCities_1 = require("../Rules/RebelCities");
const Seceded_1 = require("../Rules/Seceded");
const addPlayerHoldingOff_1 = require("@civ-clone/base-game-end/lib/addPlayerHoldingOff");
/** Whether taking `city` from `loser` starts a civil war: at least one `CivilWar` rule, and every one agrees. */
const breaksOut = (city, captor, loser, ruleRegistry) => {
    const answers = ruleRegistry.process(CivilWar_1.default, city, captor, loser);
    return (answers.length > 0 && answers.every((answer) => answer));
};
exports.breaksOut = breaksOut;
/**
 * The cities that join the rebels: every `RebelCities` rule's, once each, in the order the rules give them, leaving out
 * any that is destroyed, `lost`, or no longer `loser`'s.
 */
const rebelCities = (loser, lost, ruleRegistry) => [
    ...new Set(ruleRegistry
        .process(RebelCities_1.default, loser, lost)
        .flat()
        .filter((city) => city !== lost && !city.destroyed() && city.player() === loser)),
];
exports.rebelCities = rebelCities;
/**
 * The units that go with the rebels' cities, and the city each is to be homed in (or `null`), as the original moves
 * them: all of the loser's units on a square with a rebel city go; on a square with no city, all of them go if any is
 * homed in a rebel city. A unit homed in a rebel city keeps it; one homed elsewhere is rehomed in the city that took
 * it, or in its stack's first rebel home; one with no home keeps none.
 */
const rebelUnits = (game, loser, cities) => {
    const rebel = new Set(cities), stacks = new Map();
    game.units.getByPlayer(loser).forEach((unit) => {
        var _a;
        const stack = (_a = stacks.get(unit.tile())) !== null && _a !== void 0 ? _a : [];
        stack.push(unit);
        stacks.set(unit.tile(), stack);
    });
    return [...stacks.entries()].flatMap(([tile, units]) => {
        var _a;
        const cityHere = game.cities.getByTile(tile), home = cityHere !== null
            ? rebel.has(cityHere)
                ? cityHere
                : null
            : (_a = units
                .map((unit) => unit.city())
                .find((city) => city !== null && rebel.has(city))) !== null && _a !== void 0 ? _a : null;
        if (home === null) {
            return [];
        }
        return units.map((unit) => {
            const unitHome = unit.city();
            return [
                unit,
                unitHome === null ? null : rebel.has(unitHome) ? unitHome : home,
            ];
        });
    });
};
exports.rebelUnits = rebelUnits;
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
const civilWar = (game, loser, lost, { civilization, heldOff = [], leader } = {}) => {
    if (game.civilizations.entries().length === 0) {
        return null;
    }
    const cities = (0, exports.rebelCities)(loser, lost, game.rules);
    if (cities.length === 0) {
        return null;
    }
    const rebels = (0, addPlayerHoldingOff_1.default)(game, lost.tile().map(), heldOff, {
        civilization,
        leader,
    }), research = game.playerResearch.getByPlayer(rebels);
    game.playerResearch
        .getByPlayer(loser)
        .complete()
        .forEach((advance) => research.addAdvance(advance.sourceClass()));
    // Who goes with them is decided before any city changes hands.
    const units = (0, exports.rebelUnits)(game, loser, cities);
    cities.forEach((city) => city.transfer(rebels));
    units.forEach(([unit, home]) => unit.transfer(rebels, home));
    game.rules.process(Seceded_1.default, rebels, loser, cities);
    game.engine.emit('player:civil-war', loser, rebels, cities);
    return rebels;
};
exports.civilWar = civilWar;
exports.default = exports.civilWar;
//# sourceMappingURL=civilWar.js.map