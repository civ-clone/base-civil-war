import civilWar, { breaksOut, rebelCities } from '../lib/civilWar';
import Added from '@civ-clone/core-player/Rules/Added';
import Advance from '@civ-clone/core-science/Advance';
import AdvanceRegistry from '@civ-clone/core-science/AdvanceRegistry';
import Captured from '@civ-clone/core-city/Rules/Captured';
import City from '@civ-clone/core-city/City';
import CivilWar from '../Rules/CivilWar';
import Civilization from '@civ-clone/core-civilization/Civilization';
import Effect from '@civ-clone/core-rule/Effect';
import { Game } from '@civ-clone/core-game';
import Leader from '@civ-clone/core-civilization/Leader';
import Player from '@civ-clone/core-player/Player';
import PlayerResearch from '@civ-clone/core-science/PlayerResearch';
import RebelCities from '../Rules/RebelCities';
import Seceded from '../Rules/Seceded';
import Transferred from '@civ-clone/core-city/Rules/Transferred';
import Unit from '@civ-clone/core-unit/Unit';
import addPlayerHoldingOff from '@civ-clone/base-game-end/lib/addPlayerHoldingOff';
import { expect } from 'chai';
import { generateWorld } from '@civ-clone/core-world/tests/lib/buildWorld';

class Loyalists extends Civilization {}
class Loyalist extends Leader {
  static civilization(): typeof Civilization {
    return Loyalists;
  }
}
class Captors extends Civilization {}
class Captor extends Leader {
  static civilization(): typeof Civilization {
    return Captors;
  }
}
class Rebels extends Civilization {}
class Rebel extends Leader {
  static civilization(): typeof Civilization {
    return Rebels;
  }
}
class Pottery extends Advance {}
class Writing extends Advance {}
class Warrior extends Unit {}

const setUp = async () => {
  const game = new Game(),
    world = await generateWorld(undefined, game.rules),
    advances = new AdvanceRegistry(),
    log: string[] = [],
    starting: Player[] = [];

  advances.register(Pottery, Writing);
  game.civilizations.register(Loyalists, Captors, Rebels);
  game.leaders.register(Loyalist, Captor, Rebel);
  game.rules.register(
    new Added(
      new Effect((player: Player): void =>
        game.playerResearch.register(
          new PlayerResearch(player, advances, game.rules)
        )
      )
    ),
    new Added(
      'test:player/added/starting-advances',
      new Effect((player: Player): void => {
        starting.push(player);
      })
    ),
    new Captured(
      new Effect((city: City) => log.push(`captured ${city.name()}`))
    ),
    new Transferred(
      new Effect((city: City) => log.push(`transferred ${city.name()}`))
    ),
    new Seceded(
      new Effect((rebels: Player, loyalists: Player, cities: City[]) =>
        log.push(`seceded with ${cities.map((city) => city.name()).join(', ')}`)
      )
    )
  );

  const loser = addPlayerHoldingOff(game, world, [], {
      civilization: Loyalists,
    }),
    captor = addPlayerHoldingOff(game, world, [], { civilization: Captors }),
    city = (name: string, x: number, y: number): City => {
      const city = new City(loser, world.get(x, y), name, game.rules);

      game.cities.register(city);

      return city;
    },
    unit = (home: City | null, x: number, y: number): Unit => {
      const unit = new Warrior(home, loser, world.get(x, y), game.rules);

      game.units.register(unit);

      return unit;
    };

  game.engine.on(
    'player:civil-war',
    (loyalists: Player, rebels: Player, cities: City[]) =>
      log.push(
        `civil war: ${loyalists === loser ? 'loser' : '?'} lost ${
          cities.length
        }`
      )
  );
  starting.length = 0;

  return { captor, city, game, log, loser, starting, unit, world };
};

describe('breaksOut', (): void => {
  it('needs a CivilWar rule, and every one to agree', async (): Promise<void> => {
    const { captor, city, game, loser } = await setUp(),
      capital = city('Capital', 0, 0);

    expect(breaksOut(capital, captor, loser, game.rules)).false;

    game.rules.register(new CivilWar(new Effect((): boolean => true)));

    expect(breaksOut(capital, captor, loser, game.rules)).true;

    game.rules.register(new CivilWar(new Effect((): boolean => false)));

    expect(breaksOut(capital, captor, loser, game.rules)).false;
  });
});

describe('rebelCities', (): void => {
  it("takes every rule's cities once, and only the loser's others still standing", async (): Promise<void> => {
    const { captor, city, game, loser } = await setUp(),
      capital = city('Capital', 0, 0),
      [a, b, c, d] = ['A', 'B', 'C', 'D'].map((name, x) =>
        city(name, x + 2, 0)
      );

    c.destroy();
    d.capture(captor);
    game.rules.register(
      new RebelCities(new Effect((): City[] => [b, capital, a])),
      new RebelCities(new Effect((): City[] => [a, c, d]))
    );

    expect(rebelCities(loser, capital, game.rules)).eql([b, a]);
  });
});

describe('civilWar', (): void => {
  it('gives the rebels their cities as they are, the units with them, and what the loser knows', async (): Promise<void> => {
    const { captor, city, game, log, loser, starting, unit } = await setUp(),
      capital = city('Capital', 0, 0),
      loyal = city('Loyal', 4, 0),
      far = city('Far', 8, 0),
      farther = city('Farther', 8, 4),
      inFar = unit(loyal, 8, 0),
      homedFarAtSea = unit(far, 5, 5),
      stackMate = unit(loyal, 5, 5),
      homeless = unit(null, 5, 5),
      homedFarInLoyal = unit(far, 4, 0),
      homedLoyalAway = unit(loyal, 6, 7);

    [Pottery, Writing].forEach((AdvanceType) =>
      game.playerResearch.getByPlayer(loser).addAdvance(AdvanceType)
    );
    capital.capture(captor);
    log.length = 0;
    game.rules.register(
      new RebelCities(new Effect((): City[] => [far, farther]))
    );

    const rebels = civilWar(game, loser, capital, {
      heldOff: ['test:player/added/starting-advances'],
      civilization: Rebels,
    })!;

    expect(rebels.civilization()).instanceOf(Rebels);
    expect(starting).eql([]);
    expect(game.players.entries()).eql([loser, captor, rebels]);
    expect(
      game.playerResearch
        .getByPlayer(rebels)
        .complete()
        .map((advance) => advance.sourceClass())
    ).eql([Pottery, Writing]);
    expect(game.cities.getByPlayer(rebels)).eql([far, farther]);
    expect(loyal.player()).equal(loser);
    expect(far.originalPlayer()).equal(loser);
    expect(log).eql([
      'transferred Far',
      'transferred Farther',
      'seceded with Far, Farther',
      'civil war: loser lost 2',
    ]);

    const owners = (units: Unit[]) =>
        units.map((unit) => (unit.player() === rebels ? 'rebels' : 'loser')),
      homes = (units: Unit[]) =>
        units.map((unit) => (unit.city() as City | null)?.name() ?? null);

    expect(
      owners([
        inFar,
        homedFarAtSea,
        stackMate,
        homeless,
        homedFarInLoyal,
        homedLoyalAway,
      ])
    ).eql(['rebels', 'rebels', 'rebels', 'rebels', 'loser', 'loser']);
    expect(homes([inFar, homedFarAtSea, stackMate, homeless])).eql([
      'Far',
      'Far',
      'Far',
      null,
    ]);
    expect(game.units.getByPlayer(rebels).length).equal(4);
  });

  it('does nothing with no civilization left for the rebels, or no city for them', async (): Promise<void> => {
    const { captor, city, game, log, loser } = await setUp(),
      capital = city('Capital', 0, 0),
      far = city('Far', 8, 0);

    capital.capture(captor);
    log.length = 0;

    expect(civilWar(game, loser, capital)).equal(null);

    game.rules.register(new RebelCities(new Effect((): City[] => [far])));
    game.civilizations.unregister(Rebels);

    expect(civilWar(game, loser, capital)).equal(null);
    expect(game.players.length).equal(2);
    expect(far.player()).equal(loser);
    expect(log).eql([]);
  });
});
