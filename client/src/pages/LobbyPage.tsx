import React, { useState } from 'react';
import { GameSettings, GameStatePublic } from '../types/game.js';
import { socketClient } from '../socket/socketClient.js';
import { soundManager } from '../utils/audio.js';
import {
  Copy,
  Check,
  Share2,
  Users,
  Play,
  LogOut,
  Settings,
  Flame,
  Volume2,
  VolumeX,
  MessageSquare,
  Crown,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface LobbyPageProps {
  username: string;
  currentUserId: string;
  gameState: GameStatePublic | null;
  onLeaveRoom: () => void;
  onOpenChat: () => void;
  unreadChatCount: number;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
  username,
  currentUserId,
  gameState,
  onLeaveRoom,
  onOpenChat,
  unreadChatCount,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isHost = gameState?.hostId === currentUserId;

  const handleCreateRoom = () => {
    setIsLoading(true);
    setError('');
    soundManager.playSound('click');
    socketClient.socket.emit('create_room', { username }, (res) => {
      setIsLoading(false);
      if (!res.success) {
        setError(res.error || 'Failed to create room');
        soundManager.playSound('error');
      } else if (res.sessionToken && res.roomCode) {
        socketClient.saveSession(res.sessionToken, res.roomCode);
      }
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a room code');
      soundManager.playSound('error');
      return;
    }
    setIsLoading(true);
    setError('');
    soundManager.playSound('click');
    socketClient.socket.emit('join_room', { roomCode: cleanCode, username }, (res) => {
      setIsLoading(false);
      if (!res.success) {
        setError(res.error || 'Failed to join room');
        soundManager.playSound('error');
      } else if (res.sessionToken) {
        socketClient.saveSession(res.sessionToken, cleanCode);
      }
    });
  };

  const handleCopyCode = () => {
    if (!gameState?.roomCode) return;
    navigator.clipboard.writeText(gameState.roomCode);
    setCopied(true);
    soundManager.playSound('click');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!gameState?.roomCode) return;
    const url = `${window.location.origin}?code=${gameState.roomCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Play UNO Online with me!',
        text: `Join my UNO game room with code ${gameState.roomCode}!`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
    if (!muted) soundManager.playSound('click');
  };

  const handleUpdateSettings = (partial: Partial<GameSettings>) => {
    if (!isHost || !gameState) return;
    socketClient.socket.emit('update_settings', partial);
    soundManager.playSound('click');
  };

  const handleStartGame = () => {
    if (!isHost) return;
    socketClient.socket.emit('start_game');
    soundManager.playSound('click');
  };

  const handleToggleReady = () => {
    socketClient.socket.emit('toggle_ready');
    soundManager.playSound('click');
  };

  // 1. Not in a room yet -> Show CREATE / JOIN screen
  if (!gameState) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-radial from-[#0B1830] via-[#07111F] to-[#040810] text-white select-none">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center">
            <span className="text-xs font-bold text-[#00E5C7] uppercase tracking-widest bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-500/30">
              Welcome, {username}
            </span>
            <h2 className="text-3xl font-black mt-3 mb-1 text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#59F3E8]">
              MULTIPLAYER LOBBY
            </h2>
            <p className="text-slate-400 text-xs font-medium">
              Create a room to host friends or enter a room code to join.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold text-center">
              ⚠️ {error}
            </div>
          )}

          {/* Action Cards */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-xl font-black text-sm tracking-wider uppercase bg-gradient-to-r from-[#00E5C7] to-cyan-500 hover:from-[#59F3E8] hover:to-cyan-400 text-slate-950 shadow-lg shadow-[#00E5C7]/25 transition transform hover:scale-102 active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              CREATE NEW ROOM
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/10" />
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-500 uppercase">OR</span>
              <div className="flex-grow border-t border-white/10" />
            </div>

            {/* Join Room Form */}
            <form onSubmit={handleJoinRoom} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Join With Room Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. UNO7K2"
                  maxLength={8}
                  className="w-full bg-[#07111F]/90 border border-white/20 focus:border-[#00E5C7] rounded-xl px-4 py-3 text-center tracking-widest font-mono text-lg font-bold text-[#00E5C7] placeholder-slate-600 focus:outline-none uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !joinCode.trim()}
                className="w-full py-3.5 px-6 rounded-xl font-black text-xs tracking-wider uppercase bg-slate-800 hover:bg-slate-700 border border-white/10 text-white transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Users className="w-4 h-4 text-[#00E5C7]" />
                JOIN ROOM
              </button>
            </form>
          </div>

          {/* Sound & Footer Controls */}
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <button
              onClick={handleToggleSound}
              className="flex items-center gap-1.5 hover:text-white transition cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[#00E5C7]" />}
              <span>{isMuted ? 'Sound Muted' : 'Sound On'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. In Room Waiting Lobby
  const me = gameState.players.find((p) => p.id === currentUserId);
  const { settings } = gameState;

  return (
    <div className="min-h-screen w-full p-4 sm:p-6 bg-radial from-[#0B1830] via-[#07111F] to-[#040810] text-white select-none safe-area-container flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">ROOM:</span>
            <span className="font-mono font-black text-lg text-[#00E5C7] tracking-wider">
              {gameState.roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-1 rounded bg-white/10 hover:bg-white/20 transition cursor-pointer"
              title="Copy Room Code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
            </button>
          </div>

          <button
            onClick={handleShare}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>Invite</span>
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSound}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 transition cursor-pointer"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[#00E5C7]" />}
          </button>

          <button
            onClick={onOpenChat}
            className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 transition cursor-pointer"
            title="Open Chat"
          >
            <MessageSquare className="w-4 h-4 text-[#00E5C7]" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                {unreadChatCount}
              </span>
            )}
          </button>

          <button
            onClick={onLeaveRoom}
            className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 transition cursor-pointer"
            title="Leave Room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Grid: Players List (Left) + Game Settings (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Players Panel */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00E5C7]" />
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                PLAYERS IN ROOM
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-[#00E5C7] text-xs font-black">
              {gameState.players.length} / {settings.maxPlayers}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {gameState.players.map((p) => {
              const isCurrentMe = p.id === currentUserId;
              return (
                <div
                  key={p.id}
                  className={`
                    p-3 rounded-xl border flex items-center justify-between transition
                    ${
                      isCurrentMe
                        ? 'bg-cyan-950/40 border-[#00E5C7]/50 shadow-md shadow-cyan-900/20'
                        : 'bg-slate-900/50 border-white/10'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-black text-xs text-white uppercase shadow">
                      {p.username.slice(0, 2)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white truncate">{p.username}</span>
                        {p.isHost && (
                          <span title="Host">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {p.isConnected ? 'Connected' : 'Reconnecting...'}
                      </span>
                    </div>
                  </div>

                  <div>
                    {p.isReady ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] font-black">
                        READY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-medium">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {gameState.players.length < 2 && (
            <p className="text-xs text-amber-300/80 font-medium mt-4 text-center">
              Waiting for at least 1 more player to join before starting...
            </p>
          )}
        </div>

        {/* Game Settings Panel */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#00E5C7]" />
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                GAME RULES & SETTINGS
              </h3>
            </div>
            {!isHost && (
              <span className="text-[11px] text-slate-400 font-medium">Host configures</span>
            )}
          </div>

          {/* Mode Selector */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Gameplay Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!isHost}
                onClick={() => handleUpdateSettings({ mode: 'classic' })}
                className={`
                  py-2.5 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-1.5
                  ${
                    settings.mode === 'classic'
                      ? 'bg-blue-600/30 border-blue-400 text-white shadow-lg'
                      : 'bg-slate-900/50 border-white/10 text-slate-400 hover:text-white'
                  }
                  ${isHost ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <span>CLASSIC UNO</span>
              </button>

              <button
                disabled={!isHost}
                onClick={() => handleUpdateSettings({ mode: 'custom' })}
                className={`
                  py-2.5 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-1.5
                  ${
                    settings.mode === 'custom'
                      ? 'bg-gradient-to-r from-teal-900/60 to-cyan-900/60 border-[#00E5C7] text-[#00E5C7] shadow-lg shadow-cyan-950'
                      : 'bg-slate-900/50 border-white/10 text-slate-400 hover:text-white'
                  }
                  ${isHost ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>CUSTOM RULES</span>
              </button>
            </div>
          </div>

          {/* Custom Mode Options */}
          {settings.mode === 'custom' && (
            <div className="bg-black/40 rounded-xl p-3 mb-4 border border-[#00E5C7]/30 space-y-3">
              <div className="text-[11px] font-black text-[#00E5C7] uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>HOUSE RULES ENABLED</span>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isHost}
                    checked={settings.stacking}
                    onChange={(e) => handleUpdateSettings({ stacking: e.target.checked })}
                    className="accent-[#00E5C7]"
                  />
                  <span>Stacking (+2/+4)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isHost}
                    checked={settings.jumpIn}
                    onChange={(e) => handleUpdateSettings({ jumpIn: e.target.checked })}
                    className="accent-[#00E5C7]"
                  />
                  <span>Jump-In Rule</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isHost}
                    checked={settings.sevenZero}
                    onChange={(e) => handleUpdateSettings({ sevenZero: e.target.checked })}
                    className="accent-[#00E5C7]"
                  />
                  <span>7-0 Hand Swap</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isHost}
                    checked={settings.drawToPlay}
                    onChange={(e) => handleUpdateSettings({ drawToPlay: e.target.checked })}
                    className="accent-[#00E5C7]"
                  />
                  <span>Draw Until Play</span>
                </label>
              </div>

              {/* Custom Action Cards Toggles */}
              <div className="pt-2 border-t border-white/10">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Included Custom Action Cards:
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {Object.entries(settings.customCards).map(([key, enabled]) => (
                    <label key={key} className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isHost}
                        checked={enabled}
                        onChange={(e) =>
                          handleUpdateSettings({
                            customCards: {
                              ...settings.customCards,
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="accent-[#00E5C7]"
                      />
                      <span className="capitalize">{key}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Turn Timer Selector */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#00E5C7]" />
              <span>Turn Timer</span>
            </label>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[0, 15, 30, 45].map((sec) => (
                <button
                  key={sec}
                  disabled={!isHost}
                  onClick={() => handleUpdateSettings({ turnTimerSec: sec })}
                  className={`
                    py-1.5 rounded-lg border font-bold transition
                    ${
                      settings.turnTimerSec === sec
                        ? 'bg-[#00E5C7]/20 border-[#00E5C7] text-[#00E5C7]'
                        : 'bg-slate-900/60 border-white/10 text-slate-400'
                    }
                    ${isHost ? 'cursor-pointer' : 'cursor-default'}
                  `}
                >
                  {sec === 0 ? 'Off' : `${sec}s`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-400 font-medium">
          {isHost ? '👑 You are the Room Host' : 'Waiting for host to begin the match...'}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isHost && (
            <button
              onClick={handleToggleReady}
              className={`
                flex-1 sm:flex-none py-3 px-6 rounded-xl font-black text-xs tracking-wider uppercase transition cursor-pointer border
                ${
                  me?.isReady
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-white/10 text-white hover:bg-slate-700'
                }
              `}
            >
              {me?.isReady ? 'READY!' : 'SET READY'}
            </button>
          )}

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={gameState.players.length < 2}
              className="flex-1 sm:flex-none py-3.5 px-8 rounded-xl font-black text-xs tracking-wider uppercase bg-gradient-to-r from-[#00E5C7] via-teal-400 to-cyan-400 hover:from-[#59F3E8] hover:to-teal-300 text-slate-950 shadow-lg shadow-[#00E5C7]/30 transition transform hover:scale-102 active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Play className="w-4 h-4 fill-current" />
              START GAME
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
