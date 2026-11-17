# base-civil-war

A civil war for a rule set to use: when its rules say so, a civilization splits, and a new one takes some of its
cities, their units and what it knows.

The rule set decides when and which cities; this package does the split. It registers no rules: a rule set's own
`Captured` rule calls it, with its own id and priority.

## Rules

- `CivilWar` (`[City, Player, Player] → boolean`): whether taking this city from this civilization starts a civil
  war, with the city, who took it and who held it. At least one must be registered and every one must agree.
- `RebelCities` (`[Player, City] → City[]`): which cities join the rebels, given the civilization and the city whose
  loss started it. Every rule's cities go, once each.
- `Seceded` (`[Player, Player, City[]] → void`): after the split, with the rebels, the civilization they left and the
  cities they took, for the rule set's share of the rest (gold, government, the map, treaties, new capitals).

## `lib/civilWar`

- `breaksOut(city, captor, loser, ruleRegistry)`: the `CivilWar` rules' answer.
- `rebelCities(loser, lost, ruleRegistry)`: the `RebelCities` rules' cities, leaving out `lost`, destroyed cities and
  any no longer the loser's.
- `rebelUnits(game, loser, cities)`: the units that go, and where each is homed. All of the loser's units on a square
  with a rebel city go; on a square with no city, all of them go if any is homed in a rebel city. A unit keeps a rebel
  home; one homed elsewhere is rehomed with the city that took it; one with no home keeps none.
- `civilWar(game, loser, lost, { heldOff, civilization, leader })`: the split, in this order:
  1. nothing happens (`null`) with no civilization left for the rebels, or no city for them;
  2. the rebels join as a new player (`base-game-end`'s `addPlayerHoldingOff`, the `heldOff` rules off meanwhile);
  3. they know everything the loser knows;
  4. their cities change hands as they are (`City#transfer`): no `Captured` rule runs, so each keeps its buildings,
     production and people;
  5. their units change hands (`Unit#transfer`);
  6. the `Seceded` rules run;
  7. `player:civil-war` is emitted with the loser, the rebels and their cities.

A rule set wires it up with a `Captured` rule, for instance:

```ts
new Captured(
  'my-ruleset:city/captured/civil-war',
  new Criterion((city: City, captor: Player, loser: Player): boolean =>
    breaksOut(city, captor, loser, game.rules)
  ),
  new Effect((city: City, captor: Player, loser: Player): void => {
    civilWar(game, loser, city, { heldOff: ['my-ruleset:player/added/starting-advances'] });
  })
);
```
