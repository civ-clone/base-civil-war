"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.civilWar = exports.splitUnits = exports.rebelCities = exports.breaksOut = void 0;
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
 * What happens to the loser's units, as the original moves them. In `units.getByPlayer` order, each unit not yet
 * settled is decided by the city on its square or, with none there, by its home city (a unit with neither is left as
 * it is). If that city is a rebel city, the unit's whole stack (the loser's units on its square) goes to the rebels;
 * if it is one of the loser's other cities, the stack stays. Either way, a unit in the stack homed in a city of the
 * other side is rehomed in the deciding city, so every home stays its owner's. So the first unit of a stack at large
 * with a home decides for the stack.
 *
 * Only the units that change are listed: those that go, and those that stay but are rehomed.
 */
const splitUnits = (game, loser, cities) => {
    const rebel = new Set(cities), units = game.units.getByPlayer(loser), settled = new Set(), changes = [], sideOf = (city) => city === null
        ? null
        : rebel.has(city)
            ? 'rebel'
            : city.player() === loser
                ? 'loyal'
                : null;
    units.forEach((unit) => {
        var _a;
        if (settled.has(unit)) {
            return;
        }
        const deciding = (_a = game.cities.getByTile(unit.tile())) !== null && _a !== void 0 ? _a : unit.city(), side = sideOf(deciding);
        if (side === null) {
            return;
        }
        units
            .filter((other) => other.tile() === unit.tile())
            .forEach((member) => {
            settled.add(member);
            const home = member.city(), newHome = home === null || sideOf(home) === side ? home : deciding;
            if (side === 'rebel' || newHome !== home) {
                changes.push([member, side === 'rebel', newHome]);
            }
        });
    });
    return changes;
};
exports.splitUnits = splitUnits;
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
    const units = (0, exports.splitUnits)(game, loser, cities);
    cities.forEach((city) => city.transfer(rebels));
    units.forEach(([unit, toRebels, home]) => {
        if (toRebels) {
            unit.transfer(rebels, home);
            return;
        }
        unit.setCity(home);
    });
    game.rules.process(Seceded_1.default, rebels, loser, cities);
    game.engine.emit('player:civil-war', loser, rebels, cities);
    return rebels;
};
exports.civilWar = civilWar;
exports.default = exports.civilWar;
//# sourceMappingURL=civilWar.js.map