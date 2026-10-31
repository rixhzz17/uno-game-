import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../game/engine.js';
import { createClassicDeck, createDeck } from '../game/deck.js';

describe('UNO Game Engine - Classic and Custom Rules', () => {
  it('creates a classic 108-card deck with correct card counts', () => {
    const deck = createClassicDeck();
    expect(deck.length).toBe(108);

    const colors = ['red', 'blue', 'green', 'yellow'];
    for (const color of colors) {
      const colorCards = deck.filter((c) => c.color === color);
      // 1 zero + 18 numbers (1-9 twice) + 2 skip + 2 reverse + 2 draw2 = 25 cards per color
      expect(colorCards.length).toBe(25);

      const zeros = colorCards.filter((c) => c.value === '0');
      expect(zeros.length).toBe(1);

      const skips = colorCards.filter((c) => c.value === 'skip');
      expect(skips.length).toBe(2);

      const reverses = colorCards.filter((c) => c.value === 'reverse');
      expect(reverses.length).toBe(2);

      const draw2s = colorCards.filter((c) => c.value === 'draw2');
      expect(draw2s.length).toBe(2);
    }

    const wilds = deck.filter((c) => c.value === 'wild');
    expect(wilds.length).toBe(4);

    const wild4s = deck.filter((c) => c.value === 'wild4');
    expect(wild4s.length).toBe(4);
  });

  it('enforces maximum 10 players and rejects an 11th player', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    for (let i = 1; i <= 10; i++) {
      const added = engine.addPlayer(`p${i}`, `Player ${i}`);
      expect(added).toBe(true);
    }
    expect(engine.players.length).toBe(10);

    // 11th player attempt
    const eleventh = engine.addPlayer('p11', 'Player 11');
    expect(eleventh).toBe(false);
    expect(engine.players.length).toBe(10);
  });

  it('deals 7 cards to each player at the start of the game', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.addPlayer('p3', 'Charlie');

    const started = engine.startGame();
    expect(started).toBe(true);
    expect(engine.status).toBe('playing');

    for (const player of engine.players) {
      expect(player.hand.length).toBe(7);
      expect(player.cardCount).toBe(7);
    }
    expect(engine.topCard).not.toBeNull();
    expect(engine.topCard?.value).not.toBe('wild4');
  });

  it('correctly validates legal vs illegal card plays', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame();

    // Force topCard and activeColor
    engine.discardPile = [{ id: 'test_top', color: 'red', value: '5' }];
    engine.activeColor = 'red';

    const p1 = engine.players[0];
    p1.hand = [
      { id: 'c1', color: 'red', value: '2' }, // Matching color
      { id: 'c2', color: 'blue', value: '5' }, // Matching value
      { id: 'c3', color: 'wild', value: 'wild' }, // Wild is always legal
      { id: 'c4', color: 'green', value: '9' }, // Illegal
    ];

    expect(engine.isCardPlayable(p1.hand[0], p1)).toBe(true);
    expect(engine.isCardPlayable(p1.hand[1], p1)).toBe(true);
    expect(engine.isCardPlayable(p1.hand[2], p1)).toBe(true);
    expect(engine.isCardPlayable(p1.hand[3], p1)).toBe(false);
  });

  it('handles 2-player Reverse as Skip (classic official rules)', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame();

    engine.activeColor = 'blue';
    engine.discardPile = [{ id: 'top', color: 'blue', value: '1' }];
    engine.currentTurnIndex = 0;

    const p1 = engine.players[0];
    p1.hand = [{ id: 'rev', color: 'blue', value: 'reverse' }, { id: 'c2', color: 'blue', value: '3' }];

    const res = engine.playCard(p1.id, 'rev');
    expect(res.success).toBe(true);
    // In 2 players, Alice plays Reverse and gets another turn immediately!
    expect(engine.getCurrentPlayer()?.id).toBe(p1.id);
  });

  it('reverses direction in 3+ player games', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.addPlayer('p3', 'Charlie');
    engine.startGame();

    engine.activeColor = 'yellow';
    engine.discardPile = [{ id: 'top', color: 'yellow', value: '3' }];
    engine.currentTurnIndex = 0;
    engine.direction = 1;

    const p1 = engine.players[0];
    p1.hand = [{ id: 'rev', color: 'yellow', value: 'reverse' }, { id: 'c2', color: 'yellow', value: '4' }];

    const res = engine.playCard(p1.id, 'rev');
    expect(res.success).toBe(true);
    expect(engine.direction).toBe(-1);
    // Since direction is -1, next player is Charlie (p3)
    expect(engine.getCurrentPlayer()?.id).toBe('p3');
  });

  it('executes Wild Draw 4 challenge mechanics accurately', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame();

    engine.activeColor = 'green';
    engine.discardPile = [{ id: 'top', color: 'green', value: '7' }];
    engine.currentTurnIndex = 0;

    const p1 = engine.players[0];
    const p2 = engine.players[1];

    // Case 1: Alice plays Wild 4 while secretly holding a green card (BLUFFING)
    p1.hand = [
      { id: 'w4', color: 'wild', value: 'wild4' },
      { id: 'secret_green', color: 'green', value: '2' },
      { id: 'c3', color: 'blue', value: '1' },
    ];

    const playRes = engine.playCard(p1.id, 'w4', 'blue');
    expect(playRes.success).toBe(true);
    expect(engine.pendingChallenge).not.toBeNull();

    // Bob challenges!
    const challengeRes = engine.resolveWild4Challenge(true);
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.challengerWon).toBe(true);
    // Alice was caught bluffing, so Alice must draw 4 cards!
    expect(p1.hand.length).toBe(2 + 4); // 2 remaining + 4 penalty = 6
    expect(p2.hand.length).toBe(7); // Bob drew 0
  });

  it('penalizes challenger if Wild Draw 4 was legally played without bluffing', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame();

    engine.activeColor = 'red';
    engine.discardPile = [{ id: 'top', color: 'red', value: '7' }];
    engine.currentTurnIndex = 0;

    const p1 = engine.players[0];
    const p2 = engine.players[1];

    // Alice has NO red cards (Innocent)
    p1.hand = [
      { id: 'w4', color: 'wild', value: 'wild4' },
      { id: 'c1', color: 'blue', value: '2' },
      { id: 'c2', color: 'green', value: '1' },
    ];

    engine.playCard(p1.id, 'w4', 'yellow');
    expect(engine.pendingChallenge).not.toBeNull();

    // Bob challenges innocent Alice
    const challengeRes = engine.resolveWild4Challenge(true);
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.challengerWon).toBe(false);
    // Bob must draw 6 cards (4 + 2 penalty)
    expect(p2.hand.length).toBe(7 + 6);
  });

  it('handles UNO calls and catches missed UNO with 2-card penalty', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame();

    const p1 = engine.players[0];
    const p2 = engine.players[1];

    // Alice has 2 cards and plays 1 without calling UNO
    p1.hand = [
      { id: 'c1', color: 'red', value: '3' },
      { id: 'c2', color: 'blue', value: '8' },
    ];
    engine.activeColor = 'red';
    engine.discardPile = [{ id: 'top', color: 'red', value: '1' }];
    engine.currentTurnIndex = 0;

    engine.playCard(p1.id, 'c1');
    expect(p1.hand.length).toBe(1);
    expect(p1.hasCalledUno).toBe(false);

    // Bob catches Alice!
    const catchRes = engine.catchUno(p2.id, p1.id);
    expect(catchRes.success).toBe(true);
    // Alice receives 2 penalty cards
    expect(p1.hand.length).toBe(3);
  });

  it('supports custom action cards (Draw 5, Swap Hands, Shield)', () => {
    const engine = new GameEngine('room1', 'UNO001', 'p1', {
      mode: 'custom',
      customCards: {
        draw5: true,
        swap: true,
        targetDraw: true,
        shield: true,
        gift2: true,
        doubleTurn: true,
      },
    });
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame();

    const p1 = engine.players[0];
    const p2 = engine.players[1];

    p1.hand = [{ id: 'swap_card', color: 'wild', value: 'swap', custom: true }];
    p2.hand = [
      { id: 'b1', color: 'blue', value: '1' },
      { id: 'b2', color: 'blue', value: '2' },
      { id: 'b3', color: 'blue', value: '3' },
    ];
    engine.activeColor = 'blue';
    engine.discardPile = [{ id: 'top', color: 'blue', value: '5' }];
    engine.currentTurnIndex = 0;

    // Alice plays Swap and chooses Bob
    const res = engine.playCard(p1.id, 'swap_card', 'blue', p2.id);
    expect(res.success).toBe(true);

    // Hands are swapped!
    expect(p1.hand.length).toBe(3);
    expect(p2.hand.length).toBe(0);
  });
});
