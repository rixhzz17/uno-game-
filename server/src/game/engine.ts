import {
  Card,
  CardColor,
  CustomCardToggles,
  GameSettings,
  GameStatePublic,
  PlayerPublic,
  PrivatePlayerState,
  PendingChallenge,
  PendingTargetSelection,
} from '../types/game.js';
import { createDeck, getCardScore, shuffle } from './deck.js';

export interface InternalPlayer extends PlayerPublic {
  hand: Card[];
  hasDrawnThisTurn: boolean;
  drawnCardId: string | null;
}

export class GameEngine {
  public roomId: string;
  public roomCode: string;
  public hostId: string;
  public settings: GameSettings;
  public status: GameStatePublic['status'] = 'lobby';
  public players: InternalPlayer[] = [];
  public drawPile: Card[] = [];
  public discardPile: Card[] = [];
  public activeColor: CardColor = 'red';
  public currentTurnIndex: number = 0;
  public direction: 1 | -1 = 1;
  public pendingDrawCount: number = 0;
  public pendingChallenge: PendingChallenge | null = null;
  public pendingTargetSelection: PendingTargetSelection | null = null;
  public lastAction: GameStatePublic['lastAction'] = null;
  public winnerId: string | null = null;
  public roundWinnerId: string | null = null;
  public roundNumber: number = 1;
  public turnDeadline: number | null = null;

  // Track pre-play hand for Wild Draw 4 challenge verification
  private prePlayHands: Map<string, Card[]> = new Map();

  constructor(roomId: string, roomCode: string, hostId: string, initialSettings?: Partial<GameSettings>) {
    this.roomId = roomId;
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.settings = {
      mode: 'classic',
      maxPlayers: 10,
      turnTimerSec: 30,
      stacking: false,
      jumpIn: false,
      sevenZero: false,
      drawToPlay: false,
      cumulativeScore: false,
      customCards: {
        draw5: true,
        swap: true,
        targetDraw: true,
        shield: true,
        gift2: true,
        doubleTurn: true,
      },
      ...initialSettings,
    };
  }

  public addPlayer(id: string, username: string, avatarSeed?: string): boolean {
    if (this.players.length >= this.settings.maxPlayers) {
      return false;
    }
    const existing = this.players.find((p) => p.id === id);
    if (existing) {
      existing.isConnected = true;
      existing.username = username;
      return true;
    }

    const isHost = this.players.length === 0 || this.hostId === id;
    if (isHost) this.hostId = id;

    this.players.push({
      id,
      username,
      avatarSeed: avatarSeed || username,
      isHost,
      isConnected: true,
      cardCount: 0,
      score: 0,
      hasCalledUno: false,
      isReady: isHost,
      shieldActive: false,
      hand: [],
      hasDrawnThisTurn: false,
      drawnCardId: null,
    });
    return true;
  }

  public removePlayer(id: string): void {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;

    const removed = this.players.splice(idx, 1)[0];
    // Return player's hand to draw pile if during game
    if (this.status === 'playing' && removed.hand.length > 0) {
      this.drawPile.push(...removed.hand);
      this.drawPile = shuffle(this.drawPile);
    }

    if (this.hostId === id && this.players.length > 0) {
      this.players[0].isHost = true;
      this.hostId = this.players[0].id;
    }

    if (this.currentTurnIndex >= this.players.length) {
      this.currentTurnIndex = 0;
    }

    if (this.players.length < 2 && this.status === 'playing') {
      this.status = 'game_over';
      this.winnerId = this.players[0]?.id || null;
    }
  }

  public startGame(): boolean {
    if (this.players.length < 2) return false;
    if (this.status === 'playing') return false;

    // Reset game state
    this.drawPile = createDeck(this.settings, this.players.length);
    this.discardPile = [];
    this.currentTurnIndex = 0;
    this.direction = 1;
    this.pendingDrawCount = 0;
    this.pendingChallenge = null;
    this.pendingTargetSelection = null;
    this.winnerId = null;
    this.roundWinnerId = null;
    this.status = 'playing';

    // Deal 7 cards to each player
    for (const player of this.players) {
      player.hand = this.drawPile.splice(0, 7);
      player.cardCount = player.hand.length;
      player.hasCalledUno = false;
      player.shieldActive = false;
      player.hasDrawnThisTurn = false;
      player.drawnCardId = null;
    }

    // Flip top card for discard pile.
    // Classic rule: if Wild Draw 4 is flipped, reshuffle into deck and draw another
    let initialCard = this.drawPile.shift()!;
    while (initialCard.value === 'wild4' || initialCard.custom) {
      this.drawPile.push(initialCard);
      this.drawPile = shuffle(this.drawPile);
      initialCard = this.drawPile.shift()!;
    }

    this.discardPile.push(initialCard);

    if (initialCard.color === 'wild') {
      // First player chooses color; default to red until picked or pick random
      const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
      this.activeColor = colors[Math.floor(Math.random() * colors.length)];
    } else {
      this.activeColor = initialCard.color;
    }

    this.lastAction = {
      playerId: 'system',
      action: `Round ${this.roundNumber} started! Top card is ${this.getCardName(initialCard)}.`,
      card: initialCard,
      color: this.activeColor,
      timestamp: Date.now(),
    };

    // Handle initial action card effects
    this.applyInitialCardEffect(initialCard);
    this.updateTurnDeadline();

    return true;
  }

  private applyInitialCardEffect(card: Card): void {
    if (card.value === 'skip') {
      // First player is skipped
      this.advanceTurn(1);
    } else if (card.value === 'reverse') {
      // Direction changes. With 2 players, acts as skip
      if (this.players.length === 2) {
        this.advanceTurn(1);
      } else {
        this.direction = -1;
        this.currentTurnIndex = this.players.length - 1;
      }
    } else if (card.value === 'draw2') {
      // First player draws 2 cards and turn is skipped
      const firstPlayer = this.players[this.currentTurnIndex];
      this.giveCardsToPlayer(firstPlayer, 2);
      this.advanceTurn(1);
    }
  }

  public get topCard(): Card | null {
    return this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null;
  }

  public getCurrentPlayer(): InternalPlayer | undefined {
    return this.players[this.currentTurnIndex];
  }

  public advanceTurn(steps: number = 1): void {
    if (this.players.length === 0) return;
    const len = this.players.length;
    this.currentTurnIndex = (this.currentTurnIndex + this.direction * steps) % len;
    if (this.currentTurnIndex < 0) {
      this.currentTurnIndex += len;
    }
    const current = this.getCurrentPlayer();
    if (current) {
      current.hasDrawnThisTurn = false;
      current.drawnCardId = null;
    }
    this.updateTurnDeadline();
  }

  private updateTurnDeadline(): void {
    if (this.settings.turnTimerSec > 0 && this.status === 'playing') {
      this.turnDeadline = Date.now() + this.settings.turnTimerSec * 1000;
    } else {
      this.turnDeadline = null;
    }
  }

  public isCardPlayable(card: Card, player: InternalPlayer): boolean {
    if (!this.topCard) return true;

    // If pending target selection or pending challenge, normal card plays are blocked
    if (this.pendingTargetSelection || this.pendingChallenge) return false;

    // Stacking check
    if (this.pendingDrawCount > 0) {
      if (this.settings.mode === 'custom' && this.settings.stacking) {
        // Can stack matching draw card
        if (this.topCard.value === 'draw2' && card.value === 'draw2') return true;
        if (this.topCard.value === 'wild4' && card.value === 'wild4') return true;
        if (this.topCard.value === 'draw5' && card.value === 'draw5') return true;
        // Shield can always be played to block pending draw
        if (card.value === 'shield') return true;
      }
      return false;
    }

    // Wild cards can always be played
    if (card.color === 'wild') {
      return true;
    }

    // Match color or value/symbol
    if (card.color === this.activeColor) return true;
    if (card.value === this.topCard.value) return true;

    return false;
  }

  public playCard(
    playerId: string,
    cardId: string,
    chosenColor?: CardColor,
    targetPlayerId?: string,
    giftCardIds?: string[]
  ): { success: boolean; error?: string; sound?: 'play' | 'uno' | 'win' | 'skip' | 'reverse' | 'wild' | 'penalty' } {
    if (this.status !== 'playing') {
      return { success: false, error: 'Game is not in progress' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return { success: false, error: 'No active player' };

    const isCurrentTurn = currentPlayer.id === playerId;

    // Handle Jump-In rule in custom mode
    let isJumpIn = false;
    if (!isCurrentTurn) {
      if (this.settings.mode === 'custom' && this.settings.jumpIn && this.topCard) {
        const actor = this.players.find((p) => p.id === playerId);
        const cardToJump = actor?.hand.find((c) => c.id === cardId);
        if (cardToJump && cardToJump.color === this.topCard.color && cardToJump.value === this.topCard.value) {
          isJumpIn = true;
        } else {
          return { success: false, error: 'Not your turn' };
        }
      } else {
        return { success: false, error: 'Not your turn' };
      }
    }

    const actor = isJumpIn ? this.players.find((p) => p.id === playerId)! : currentPlayer;
    const cardIndex = actor.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      return { success: false, error: 'Card not in your hand' };
    }

    const card = actor.hand[cardIndex];

    if (!isJumpIn && !this.isCardPlayable(card, actor)) {
      return { success: false, error: 'Illegal move' };
    }

    // Save pre-play hand copy for Wild Draw 4 challenge verification
    this.prePlayHands.set(actor.id, [...actor.hand]);

    // Check Wild Color selection
    if (card.color === 'wild' && !chosenColor) {
      return { success: false, error: 'Must choose a color for Wild card' };
    }

    const validColors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
    if (card.color === 'wild' && chosenColor && !validColors.includes(chosenColor)) {
      return { success: false, error: 'Invalid color chosen' };
    }

    // Remove card from hand and push to discard pile
    actor.hand.splice(cardIndex, 1);
    actor.cardCount = actor.hand.length;
    this.discardPile.push(card);

    // Update active color
    const previousActiveColor = this.activeColor;
    if (card.color === 'wild') {
      this.activeColor = chosenColor!;
    } else {
      this.activeColor = card.color;
    }

    // If Jump-In occurred, turn jumps to this player
    if (isJumpIn) {
      this.currentTurnIndex = this.players.findIndex((p) => p.id === actor.id);
    }

    // Check if player won (unless playing a card that modifies hands like swap)
    if (actor.hand.length === 0 && card.value !== 'swap') {
      return this.handlePlayerWin(actor, card);
    }

    // Check UNO state: if hand count is now 1 and player didn't call UNO, they are vulnerable to catch_uno
    if (actor.hand.length === 1) {
      // If they haven't called uno, hasCalledUno remains false
    } else {
      actor.hasCalledUno = false;
    }

    let soundResult: 'play' | 'skip' | 'reverse' | 'wild' | 'penalty' = 'play';

    // Handle Card Effects
    switch (card.value) {
      case 'skip':
        soundResult = 'skip';
        this.lastAction = {
          playerId: actor.id,
          action: `${actor.username} played Skip.`,
          card,
          timestamp: Date.now(),
        };
        // In 2 players, Skip gives current player another turn!
        if (this.players.length === 2) {
          // Advance 2 steps = back to same player
          this.advanceTurn(2);
        } else {
          this.advanceTurn(2);
        }
        break;

      case 'reverse':
        soundResult = 'reverse';
        if (this.players.length === 2) {
          // Official classic 2-player rule: Reverse acts as Skip!
          this.lastAction = {
            playerId: actor.id,
            action: `${actor.username} played Reverse (Acts as Skip in 2-player mode).`,
            card,
            timestamp: Date.now(),
          };
          this.advanceTurn(2);
        } else {
          this.direction = (this.direction * -1) as 1 | -1;
          this.lastAction = {
            playerId: actor.id,
            action: `${actor.username} reversed play direction!`,
            card,
            timestamp: Date.now(),
          };
          this.advanceTurn(1);
        }
        break;

      case 'draw2':
        soundResult = 'penalty';
        if (this.settings.mode === 'custom' && this.settings.stacking) {
          this.pendingDrawCount += 2;
          this.advanceTurn(1);
          this.lastAction = {
            playerId: actor.id,
            action: `${actor.username} played Draw Two. Draw count is now +${this.pendingDrawCount}!`,
            card,
            timestamp: Date.now(),
          };
        } else {
          this.lastAction = {
            playerId: actor.id,
            action: `${actor.username} played Draw Two.`,
            card,
            timestamp: Date.now(),
          };
          const nextPlayer = this.getNextPlayer();
          if (nextPlayer.shieldActive) {
            nextPlayer.shieldActive = false;
            this.lastAction.action += ` ${nextPlayer.username}'s Shield blocked the penalty!`;
          } else {
            this.giveCardsToPlayer(nextPlayer, 2);
          }
          this.advanceTurn(2);
        }
        break;

      case 'wild':
        soundResult = 'wild';
        this.lastAction = {
          playerId: actor.id,
          action: `${actor.username} played Wild and set color to ${this.activeColor.toUpperCase()}.`,
          card,
          color: this.activeColor,
          timestamp: Date.now(),
        };
        this.advanceTurn(1);
        break;

      case 'wild4':
        soundResult = 'penalty';
        const targetVictim = this.getNextPlayer();
        // Set up pending challenge for Wild Draw 4 (Classic Rule!)
        this.pendingChallenge = {
          challengerId: targetVictim.id,
          targetId: actor.id,
          playedWild4: card,
          activeColorBefore: previousActiveColor,
          deadline: Date.now() + 15000,
        };
        this.lastAction = {
          playerId: actor.id,
          action: `${actor.username} played Wild Draw Four! Set color to ${this.activeColor.toUpperCase()}. ${targetVictim.username} may challenge or accept.`,
          card,
          color: this.activeColor,
          timestamp: Date.now(),
        };
        break;

      // CUSTOM ACTION CARDS
      case 'draw5':
        soundResult = 'penalty';
        if (this.settings.mode === 'custom' && this.settings.stacking) {
          this.pendingDrawCount += 5;
          this.advanceTurn(1);
          this.lastAction = {
            playerId: actor.id,
            action: `${actor.username} played Draw Five. Total draw penalty is +${this.pendingDrawCount}!`,
            card,
            timestamp: Date.now(),
          };
        } else {
          const nextP = this.getNextPlayer();
          if (nextP.shieldActive) {
            nextP.shieldActive = false;
            this.lastAction = {
              playerId: actor.id,
              action: `${actor.username} played Draw Five, but ${nextP.username}'s Shield blocked it!`,
              card,
              timestamp: Date.now(),
            };
          } else {
            this.giveCardsToPlayer(nextP, 5);
            this.lastAction = {
              playerId: actor.id,
              action: `${actor.username} played Draw Five on ${nextP.username}!`,
              card,
              timestamp: Date.now(),
            };
          }
          this.advanceTurn(2);
        }
        break;

      case 'swap':
        soundResult = 'wild';
        if (targetPlayerId && this.players.some((p) => p.id === targetPlayerId && p.id !== actor.id)) {
          this.executeSwap(actor.id, targetPlayerId);
          this.advanceTurn(1);
        } else {
          // Wait for target selection
          this.pendingTargetSelection = {
            playerId: actor.id,
            actionType: 'swap',
            eligibleTargetIds: this.players.filter((p) => p.id !== actor.id).map((p) => p.id),
          };
        }
        break;

      case 'target_draw':
        soundResult = 'penalty';
        if (targetPlayerId && this.players.some((p) => p.id === targetPlayerId && p.id !== actor.id)) {
          this.executeTargetDraw(actor.id, targetPlayerId);
          this.advanceTurn(1);
        } else {
          this.pendingTargetSelection = {
            playerId: actor.id,
            actionType: 'target_draw',
            eligibleTargetIds: this.players.filter((p) => p.id !== actor.id).map((p) => p.id),
          };
        }
        break;

      case 'shield':
        soundResult = 'play';
        actor.shieldActive = true;
        this.lastAction = {
          playerId: actor.id,
          action: `${actor.username} activated a Shield! Next incoming penalty will be blocked.`,
          card,
          timestamp: Date.now(),
        };
        // If there was a pending draw count on this player, it blocks it completely!
        if (this.pendingDrawCount > 0) {
          actor.shieldActive = false;
          this.lastAction.action = `${actor.username} used Shield to block all +${this.pendingDrawCount} pending cards!`;
          this.pendingDrawCount = 0;
        }
        this.advanceTurn(1);
        break;

      case 'gift2':
        soundResult = 'wild';
        if (targetPlayerId && giftCardIds && giftCardIds.length === 2) {
          this.executeGift2(actor.id, targetPlayerId, giftCardIds);
          this.advanceTurn(1);
        } else {
          this.pendingTargetSelection = {
            playerId: actor.id,
            actionType: 'gift2',
            eligibleTargetIds: this.players.filter((p) => p.id !== actor.id).map((p) => p.id),
          };
        }
        break;

      case 'double_turn':
        soundResult = 'play';
        this.lastAction = {
          playerId: actor.id,
          action: `${actor.username} played Double Turn! Takes another turn immediately.`,
          card,
          timestamp: Date.now(),
        };
        // Player takes turn again immediately: advance 0 turns!
        actor.hasDrawnThisTurn = false;
        actor.drawnCardId = null;
        this.updateTurnDeadline();
        break;

      default:
        // Number card
        soundResult = 'play';
        this.lastAction = {
          playerId: actor.id,
          action: `${actor.username} played ${this.getCardName(card)}.`,
          card,
          timestamp: Date.now(),
        };

        // Seven-Zero House Rule (Custom Mode)
        if (this.settings.mode === 'custom' && this.settings.sevenZero) {
          if (card.value === '7' && targetPlayerId) {
            this.executeSwap(actor.id, targetPlayerId);
          } else if (card.value === '0') {
            this.rotateAllHands();
          }
        }

        this.advanceTurn(1);
        break;
    }

    return { success: true, sound: soundResult };
  }

  public resolveTargetSelection(
    playerId: string,
    targetPlayerId: string,
    giftCardIds?: string[]
  ): { success: boolean; error?: string } {
    if (!this.pendingTargetSelection || this.pendingTargetSelection.playerId !== playerId) {
      return { success: false, error: 'No pending target selection for you' };
    }

    if (!this.pendingTargetSelection.eligibleTargetIds.includes(targetPlayerId)) {
      return { success: false, error: 'Invalid target player' };
    }

    const { actionType } = this.pendingTargetSelection;
    this.pendingTargetSelection = null;

    if (actionType === 'swap') {
      this.executeSwap(playerId, targetPlayerId);
    } else if (actionType === 'target_draw') {
      this.executeTargetDraw(playerId, targetPlayerId);
    } else if (actionType === 'gift2') {
      if (!giftCardIds || giftCardIds.length !== 2) {
        return { success: false, error: 'Must select exactly 2 cards to gift' };
      }
      this.executeGift2(playerId, targetPlayerId, giftCardIds);
    }

    this.advanceTurn(1);
    return { success: true };
  }

  private executeSwap(playerId: string, targetPlayerId: string): void {
    const p1 = this.players.find((p) => p.id === playerId);
    const p2 = this.players.find((p) => p.id === targetPlayerId);
    if (!p1 || !p2) return;

    const tempHand = p1.hand;
    p1.hand = p2.hand;
    p2.hand = tempHand;

    p1.cardCount = p1.hand.length;
    p2.cardCount = p2.hand.length;

    p1.hasCalledUno = false;
    p2.hasCalledUno = false;

    this.lastAction = {
      playerId: p1.id,
      action: `${p1.username} swapped hands with ${p2.username}!`,
      timestamp: Date.now(),
    };

    if (p1.hand.length === 0) {
      this.handlePlayerWin(p1, this.topCard!);
    } else if (p2.hand.length === 0) {
      this.handlePlayerWin(p2, this.topCard!);
    }
  }

  private executeTargetDraw(playerId: string, targetPlayerId: string): void {
    const p1 = this.players.find((p) => p.id === playerId);
    const p2 = this.players.find((p) => p.id === targetPlayerId);
    if (!p1 || !p2) return;

    if (p2.shieldActive) {
      p2.shieldActive = false;
      this.lastAction = {
        playerId: p1.id,
        action: `${p1.username} targeted ${p2.username} to draw 3 cards, but ${p2.username}'s Shield blocked it!`,
        timestamp: Date.now(),
      };
    } else {
      this.giveCardsToPlayer(p2, 3);
      this.lastAction = {
        playerId: p1.id,
        action: `${p1.username} targeted ${p2.username} who drew 3 cards!`,
        timestamp: Date.now(),
      };
    }
  }

  private executeGift2(playerId: string, targetPlayerId: string, giftCardIds: string[]): void {
    const sender = this.players.find((p) => p.id === playerId);
    const receiver = this.players.find((p) => p.id === targetPlayerId);
    if (!sender || !receiver) return;

    const gifted: Card[] = [];
    for (const cid of giftCardIds) {
      const idx = sender.hand.findIndex((c) => c.id === cid);
      if (idx !== -1) {
        gifted.push(sender.hand.splice(idx, 1)[0]);
      }
    }

    receiver.hand.push(...gifted);
    sender.cardCount = sender.hand.length;
    receiver.cardCount = receiver.hand.length;

    sender.hasCalledUno = false;
    receiver.hasCalledUno = false;

    this.lastAction = {
      playerId: sender.id,
      action: `${sender.username} gifted 2 cards to ${receiver.username}!`,
      timestamp: Date.now(),
    };
  }

  private rotateAllHands(): void {
    const hands = this.players.map((p) => p.hand);
    const len = this.players.length;
    for (let i = 0; i < len; i++) {
      const fromIdx = (i - this.direction + len) % len;
      this.players[i].hand = hands[fromIdx];
      this.players[i].cardCount = this.players[i].hand.length;
      this.players[i].hasCalledUno = false;
    }
    this.lastAction = {
      playerId: 'system',
      action: `A 0 was played! All players rotated hands in the direction of play.`,
      timestamp: Date.now(),
    };
  }

  public resolveWild4Challenge(acceptChallenge: boolean): { success: boolean; challengerWon?: boolean; message: string } {
    if (!this.pendingChallenge) {
      return { success: false, message: 'No pending Wild Draw 4 challenge' };
    }

    const { challengerId, targetId, activeColorBefore } = this.pendingChallenge;
    const challenger = this.players.find((p) => p.id === challengerId);
    const targetPlayer = this.players.find((p) => p.id === targetId);

    this.pendingChallenge = null;

    if (!challenger || !targetPlayer) {
      return { success: false, message: 'Players not found' };
    }

    if (!acceptChallenge) {
      // Challenger declines to challenge: simply draws 4 cards and loses turn
      if (challenger.shieldActive) {
        challenger.shieldActive = false;
        this.lastAction = {
          playerId: challenger.id,
          action: `${challenger.username} accepted the Wild Draw 4, but their Shield blocked all 4 cards!`,
          timestamp: Date.now(),
        };
      } else {
        this.giveCardsToPlayer(challenger, 4);
        this.lastAction = {
          playerId: challenger.id,
          action: `${challenger.username} accepted the Wild Draw 4 and drew 4 cards.`,
          timestamp: Date.now(),
        };
      }
      // Challenger loses turn -> advance past challenger
      this.advanceTurn(2);
      return { success: true, challengerWon: false, message: `${challenger.username} accepted penalty.` };
    }

    // Challenger challenges!
    // Check if target had a card of activeColorBefore in their pre-play hand
    const preHand = this.prePlayHands.get(targetId) || [];
    const hadMatchingColor = preHand.some((c) => c.color === activeColorBefore && c.value !== 'wild4');

    if (hadMatchingColor) {
      // Target was BLUFFING/ILLEGALLY played Wild 4!
      // Target player draws 4 cards as punishment. Challenger draws 0!
      this.giveCardsToPlayer(targetPlayer, 4);
      this.lastAction = {
        playerId: challenger.id,
        action: `CHALLENGE SUCCESSFUL! ${targetPlayer.username} had matching ${activeColorBefore} cards and must draw 4 cards!`,
        timestamp: Date.now(),
      };
      // Challenger takes their turn normally!
      this.advanceTurn(1);
      return {
        success: true,
        challengerWon: true,
        message: `Challenge successful! ${targetPlayer.username} draws 4 cards.`,
      };
    } else {
      // Target was INNOCENT!
      // Challenger must draw 6 cards (4 + 2 penalty) and lose their turn!
      this.giveCardsToPlayer(challenger, 6);
      this.lastAction = {
        playerId: challenger.id,
        action: `CHALLENGE FAILED! ${targetPlayer.username} was innocent. ${challenger.username} draws 6 cards (4 + 2 penalty) and loses their turn!`,
        timestamp: Date.now(),
      };
      this.advanceTurn(2);
      return {
        success: true,
        challengerWon: false,
        message: `Challenge failed! ${challenger.username} draws 6 cards and loses turn.`,
      };
    }
  }

  public drawCard(playerId: string): { success: boolean; drawnCard?: Card; error?: string } {
    if (this.status !== 'playing') {
      return { success: false, error: 'Game not in progress' };
    }

    const current = this.getCurrentPlayer();
    if (!current || current.id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.pendingTargetSelection || this.pendingChallenge) {
      return { success: false, error: 'Pending action must be resolved first' };
    }

    // If there is a pending draw count (e.g. from stacked cards)
    if (this.pendingDrawCount > 0) {
      const count = this.pendingDrawCount;
      this.pendingDrawCount = 0;
      this.giveCardsToPlayer(current, count);
      this.lastAction = {
        playerId: current.id,
        action: `${current.username} could not stack and drew ${count} cards!`,
        timestamp: Date.now(),
      };
      this.advanceTurn(1);
      return { success: true };
    }

    // Classic Draw rule: draw 1 card
    const drawn = this.drawFromDeck();
    if (!drawn) {
      return { success: false, error: 'Deck is empty' };
    }

    current.hand.push(drawn);
    current.cardCount = current.hand.length;
    current.hasDrawnThisTurn = true;
    current.drawnCardId = drawn.id;
    current.hasCalledUno = false; // drawing cancels 1-card status

    this.lastAction = {
      playerId: current.id,
      action: `${current.username} drew a card.`,
      timestamp: Date.now(),
    };

    // If custom mode has "drawToPlay" enabled, keep drawing until playable
    if (this.settings.mode === 'custom' && this.settings.drawToPlay) {
      if (!this.isCardPlayable(drawn, current)) {
        // Continue drawing in UI or loop
      }
    }

    return { success: true, drawnCard: drawn };
  }

  public passTurn(playerId: string): { success: boolean; error?: string } {
    if (this.status !== 'playing') {
      return { success: false, error: 'Game not in progress' };
    }

    const current = this.getCurrentPlayer();
    if (!current || current.id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (!current.hasDrawnThisTurn) {
      return { success: false, error: 'Must draw a card before passing' };
    }

    this.lastAction = {
      playerId: current.id,
      action: `${current.username} passed their turn.`,
      timestamp: Date.now(),
    };

    this.advanceTurn(1);
    return { success: true };
  }

  public callUno(playerId: string): { success: boolean; error?: string } {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    // Player can call UNO if they have 2 cards (anticipating playing down to 1) or exactly 1 card
    if (player.hand.length > 2) {
      return { success: false, error: 'You have too many cards to call UNO' };
    }

    player.hasCalledUno = true;
    this.lastAction = {
      playerId: player.id,
      action: `🔥 ${player.username} called UNO! 🔥`,
      timestamp: Date.now(),
    };
    return { success: true };
  }

  public catchUno(catcherId: string, targetPlayerId: string): { success: boolean; error?: string } {
    const catcher = this.players.find((p) => p.id === catcherId);
    const target = this.players.find((p) => p.id === targetPlayerId);

    if (!catcher || !target) return { success: false, error: 'Player not found' };

    if (target.hand.length !== 1) {
      return { success: false, error: 'Target does not have exactly 1 card' };
    }

    if (target.hasCalledUno) {
      return { success: false, error: 'Target already called UNO safely' };
    }

    // Target caught! Penalty: draw 2 cards
    this.giveCardsToPlayer(target, 2);
    target.hasCalledUno = false;

    this.lastAction = {
      playerId: catcher.id,
      action: `🚨 ${catcher.username} caught ${target.username} for not calling UNO! ${target.username} drew 2 penalty cards!`,
      timestamp: Date.now(),
    };

    return { success: true };
  }

  private handlePlayerWin(
    winner: InternalPlayer,
    lastCard: Card
  ): { success: boolean; sound: 'win'; error?: string } {
    this.roundWinnerId = winner.id;

    // Calculate score of round based on opponents' remaining cards
    let roundPoints = 0;
    for (const player of this.players) {
      if (player.id !== winner.id) {
        for (const card of player.hand) {
          roundPoints += getCardScore(card);
        }
      }
    }

    winner.score += roundPoints;

    if (this.settings.cumulativeScore && winner.score >= 500) {
      this.status = 'game_over';
      this.winnerId = winner.id;
      this.lastAction = {
        playerId: winner.id,
        action: `🏆 ${winner.username} reached 500+ points (${winner.score} pts) and won the entire game! 🏆`,
        card: lastCard,
        timestamp: Date.now(),
      };
    } else if (!this.settings.cumulativeScore) {
      // Single-round mode
      this.status = 'round_over';
      this.winnerId = winner.id;
      this.lastAction = {
        playerId: winner.id,
        action: `🎉 ${winner.username} played their final card and won Round ${this.roundNumber}! 🎉`,
        card: lastCard,
        timestamp: Date.now(),
      };
    } else {
      // Cumulative round over
      this.status = 'round_over';
      this.lastAction = {
        playerId: winner.id,
        action: `🎉 ${winner.username} won Round ${this.roundNumber} with +${roundPoints} points! (Total: ${winner.score})`,
        card: lastCard,
        timestamp: Date.now(),
      };
    }

    return { success: true, sound: 'win' };
  }

  public startNextRound(): boolean {
    if (this.status !== 'round_over') return false;
    this.roundNumber++;
    return this.startGame();
  }

  private giveCardsToPlayer(player: InternalPlayer, count: number): void {
    for (let i = 0; i < count; i++) {
      const card = this.drawFromDeck();
      if (card) {
        player.hand.push(card);
      }
    }
    player.cardCount = player.hand.length;
    player.hasCalledUno = false;
  }

  private drawFromDeck(): Card | null {
    if (this.drawPile.length === 0) {
      this.reshuffleDiscardIntoDraw();
    }
    return this.drawPile.shift() || null;
  }

  private reshuffleDiscardIntoDraw(): void {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop()!;
    this.drawPile = shuffle(this.discardPile);
    this.discardPile = [top];
  }

  public getNextPlayer(): InternalPlayer {
    const len = this.players.length;
    let nextIdx = (this.currentTurnIndex + this.direction) % len;
    if (nextIdx < 0) nextIdx += len;
    return this.players[nextIdx];
  }

  private getCardName(card: Card): string {
    const color = card.color !== 'wild' ? card.color.toUpperCase() : 'WILD';
    return `${color} ${card.value.toUpperCase()}`;
  }

  public getPublicState(): GameStatePublic {
    const current = this.getCurrentPlayer();
    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      status: this.status,
      settings: this.settings,
      hostId: this.hostId,
      players: this.players.map((p) => ({
        id: p.id,
        username: p.username,
        avatarSeed: p.avatarSeed,
        isHost: p.isHost,
        isConnected: p.isConnected,
        cardCount: p.hand.length,
        score: p.score,
        hasCalledUno: p.hasCalledUno,
        isReady: p.isReady,
        shieldActive: p.shieldActive,
      })),
      currentTurn: current ? current.id : '',
      direction: this.direction,
      topCard: this.topCard,
      activeColor: this.activeColor,
      drawPileCount: this.drawPile.length,
      discardPileCount: this.discardPile.length,
      pendingDrawCount: this.pendingDrawCount,
      pendingChallenge: this.pendingChallenge,
      pendingTargetSelection: this.pendingTargetSelection,
      lastAction: this.lastAction,
      winnerId: this.winnerId,
      roundWinnerId: this.roundWinnerId,
      turnDeadline: this.turnDeadline,
      roundNumber: this.roundNumber,
    };
  }

  public getPrivateState(playerId: string): PrivatePlayerState {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      return {
        hand: [],
        canDraw: false,
        canPass: false,
        canCallUno: false,
        canCatchUnoPlayerIds: [],
      };
    }

    const isCurrent = this.getCurrentPlayer()?.id === playerId;
    const canDraw = isCurrent && !player.hasDrawnThisTurn;
    const canPass = isCurrent && player.hasDrawnThisTurn;
    const canCallUno = player.hand.length <= 2 && !player.hasCalledUno;

    const canCatchUnoPlayerIds = this.players
      .filter((p) => p.id !== playerId && p.hand.length === 1 && !p.hasCalledUno)
      .map((p) => p.id);

    return {
      hand: player.hand,
      canDraw,
      canPass,
      canCallUno,
      canCatchUnoPlayerIds,
    };
  }
}
