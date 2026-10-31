import { Card, CardColor, CardValue, GameSettings } from '../types/game.js';

export function createClassicDeck(): Card[] {
  const deck: Card[] = [];
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];

  let idCounter = 1;

  for (const color of colors) {
    // One '0' per color
    deck.push({ id: `c_${color}_0_${idCounter++}`, color, value: '0' });

    // Two each of '1' to '9'
    for (let num = 1; num <= 9; num++) {
      const val = num.toString() as CardValue;
      deck.push({ id: `c_${color}_${val}_${idCounter++}`, color, value: val });
      deck.push({ id: `c_${color}_${val}_${idCounter++}`, color, value: val });
    }

    // Two of each action per color
    for (const action of ['skip', 'reverse', 'draw2'] as CardValue[]) {
      deck.push({ id: `c_${color}_${action}_${idCounter++}`, color, value: action });
      deck.push({ id: `c_${color}_${action}_${idCounter++}`, color, value: action });
    }
  }

  // 4 Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_wild_${idCounter++}`, color: 'wild', value: 'wild' });
  }

  // 4 Wild Draw Four cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_wild4_${idCounter++}`, color: 'wild', value: 'wild4' });
  }

  return deck;
}

export function createDeck(settings: GameSettings, playerCount: number = 4): Card[] {
  let deck = createClassicDeck();

  if (settings.mode === 'custom') {
    let idCounter = 1000;
    const { customCards } = settings;

    if (customCards.draw5) {
      // 4 Draw Five cards
      for (const color of ['red', 'blue', 'green', 'yellow'] as CardColor[]) {
        deck.push({ id: `custom_draw5_${color}_${idCounter++}`, color, value: 'draw5', custom: true });
      }
    }

    if (customCards.swap) {
      // 4 Swap cards (wild)
      for (let i = 0; i < 4; i++) {
        deck.push({ id: `custom_swap_${idCounter++}`, color: 'wild', value: 'swap', custom: true });
      }
    }

    if (customCards.targetDraw) {
      // 4 Target Draw cards (wild)
      for (let i = 0; i < 4; i++) {
        deck.push({ id: `custom_targetdraw_${idCounter++}`, color: 'wild', value: 'target_draw', custom: true });
      }
    }

    if (customCards.shield) {
      // 4 Shield cards (1 per color)
      for (const color of ['red', 'blue', 'green', 'yellow'] as CardColor[]) {
        deck.push({ id: `custom_shield_${color}_${idCounter++}`, color, value: 'shield', custom: true });
      }
    }

    if (customCards.gift2) {
      // 4 Gift Two cards (wild)
      for (let i = 0; i < 4; i++) {
        deck.push({ id: `custom_gift2_${idCounter++}`, color: 'wild', value: 'gift2', custom: true });
      }
    }

    if (customCards.doubleTurn) {
      // 4 Double Turn cards (1 per color)
      for (const color of ['red', 'blue', 'green', 'yellow'] as CardColor[]) {
        deck.push({ id: `custom_double_${color}_${idCounter++}`, color, value: 'double_turn', custom: true });
      }
    }
  }

  // If 7 or more players, duplicate a portion of standard number cards to prevent immediate discard reshuffling
  if (playerCount >= 7) {
    const extraDeck = createClassicDeck().map((c) => ({
      ...c,
      id: `p2_${c.id}`,
    }));
    deck = deck.concat(extraDeck);
  }

  return shuffle(deck);
}

export function shuffle(deck: Card[]): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getCardScore(card: Card): number {
  if (card.value >= '0' && card.value <= '9') {
    return parseInt(card.value, 10);
  }
  switch (card.value) {
    case 'skip':
    case 'reverse':
    case 'draw2':
      return 20;
    case 'wild':
    case 'wild4':
      return 50;
    case 'draw5':
      return 50;
    case 'swap':
      return 40;
    case 'target_draw':
      return 30;
    case 'shield':
      return 25;
    case 'gift2':
      return 30;
    case 'double_turn':
      return 40;
    default:
      return 10;
  }
}
