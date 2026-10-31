export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';

export type CardNumber = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export type ClassicCardAction = 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export type CustomCardAction = 'draw5' | 'swap' | 'target_draw' | 'shield' | 'gift2' | 'double_turn';

export type CardValue = CardNumber | ClassicCardAction | CustomCardAction;

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
  custom?: boolean;
}

export interface CustomCardToggles {
  draw5: boolean;
  swap: boolean;
  targetDraw: boolean;
  shield: boolean;
  gift2: boolean;
  doubleTurn: boolean;
}

export interface GameSettings {
  mode: 'classic' | 'custom';
  maxPlayers: number; // 2..10
  turnTimerSec: number; // 0 for off, 15, 30, 45, 60
  stacking: boolean; // Custom rule: draw cards can be chained
  jumpIn: boolean; // Custom rule: play identical card out of turn
  sevenZero: boolean; // Custom rule: 7 swaps, 0 rotates hands
  drawToPlay: boolean; // Custom rule: keep drawing until playable
  cumulativeScore: boolean; // Cumulative to 500 pts vs single round
  customCards: CustomCardToggles;
}

export interface PlayerPublic {
  id: string; // Persistent Session ID
  username: string;
  avatarSeed: string;
  isHost: boolean;
  isConnected: boolean;
  cardCount: number;
  score: number;
  hasCalledUno: boolean;
  isReady: boolean;
  shieldActive: boolean;
}

export type GameStatus = 'lobby' | 'playing' | 'round_over' | 'game_over';

export interface PendingChallenge {
  challengerId: string;
  targetId: string;
  playedWild4: Card;
  activeColorBefore: CardColor;
  deadline: number;
}

export interface PendingTargetSelection {
  playerId: string;
  actionType: 'swap' | 'target_draw' | 'gift2';
  eligibleTargetIds: string[];
}

export interface LastActionSummary {
  playerId: string;
  action: string;
  card?: Card;
  color?: CardColor;
  timestamp: number;
}

export interface GameStatePublic {
  roomId: string;
  roomCode: string;
  status: GameStatus;
  settings: GameSettings;
  hostId: string;
  players: PlayerPublic[];
  currentTurn: string; // playerId
  direction: 1 | -1; // 1 = clockwise, -1 = counter-clockwise
  topCard: Card | null;
  activeColor: CardColor;
  drawPileCount: number;
  discardPileCount: number;
  pendingDrawCount: number;
  pendingChallenge: PendingChallenge | null;
  pendingTargetSelection: PendingTargetSelection | null;
  lastAction: LastActionSummary | null;
  winnerId: string | null;
  roundWinnerId: string | null;
  turnDeadline: number | null;
  roundNumber: number;
}

export interface PrivatePlayerState {
  hand: Card[];
  canDraw: boolean;
  canPass: boolean;
  canCallUno: boolean;
  canCatchUnoPlayerIds: string[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

// Client-to-Server Socket Events
export interface ClientToServerEvents {
  create_room: (
    data: { username: string; sessionToken?: string },
    callback: (res: { success: boolean; roomCode?: string; sessionToken?: string; error?: string }) => void
  ) => void;

  join_room: (
    data: { roomCode: string; username: string; sessionToken?: string },
    callback: (res: { success: boolean; sessionToken?: string; error?: string }) => void
  ) => void;

  reconnect_session: (
    data: { sessionToken: string; roomCode: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  leave_room: () => void;

  toggle_ready: () => void;

  update_settings: (settings: Partial<GameSettings>) => void;

  start_game: () => void;

  play_card: (
    data: { cardId: string; chosenColor?: CardColor; targetPlayerId?: string; giftCardIds?: string[] },
    callback?: (res: { success: boolean; error?: string }) => void
  ) => void;

  draw_card: (callback?: (res: { success: boolean; error?: string }) => void) => void;

  pass_turn: (callback?: (res: { success: boolean; error?: string }) => void) => void;

  call_uno: (callback?: (res: { success: boolean; error?: string }) => void) => void;

  catch_uno: (targetPlayerId: string, callback?: (res: { success: boolean; error?: string }) => void) => void;

  challenge_wild4: (acceptChallenge: boolean, callback?: (res: { success: boolean; error?: string }) => void) => void;

  send_chat: (text: string) => void;

  start_next_round: () => void;
}

// Server-to-Client Socket Events
export interface ServerToClientEvents {
  game_state_update: (state: GameStatePublic) => void;
  private_state_update: (state: PrivatePlayerState) => void;
  chat_message: (message: ChatMessage) => void;
  chat_history: (messages: ChatMessage[]) => void;
  action_notification: (data: { type: string; message: string; playerId?: string; card?: Card }) => void;
  sound_effect: (sound: 'play' | 'draw' | 'uno' | 'win' | 'skip' | 'reverse' | 'wild' | 'penalty' | 'error') => void;
  error_message: (message: string) => void;
}
