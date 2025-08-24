import React, { useState, useReducer, useCallback, useEffect, useRef } from 'react';
import { GameData, Player, GamePhase, Character, Asset, GameMode, ChatMessage } from './types';
import { gameReducer, Action } from './state/reducer';
import { INITIAL_GAME_DATA } from './constants';
import SetupView from './components/SetupView';
import GameView from './components/GameView';
import GMMenu from './components/GMMenu';
import GmRulesModal from './components/GmRulesModal';
import TutorialModal from './components/TutorialModal';
import LobbyChat from './components/LobbyChat';
import * as network from './services/networkService';
import { MAX_PLAYERS } from './constants';
import { signInAnonymouslyIfNeeded } from './services/firebase';


const App: React.FC = () => {
  const [gameData, dispatch] = useReducer(gameReducer, INITIAL_GAME_DATA);
  const [players, setPlayers] = useState<Player[]>([{ id: `p-1`, name: 'Player 1', lastSeenLogIndex: 0 }]);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isGmMenuOpen, setIsGmMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const [gameMode, setGameMode] = useState<GameMode>('local');
  const [gameId, setGameId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const connectionTimeoutRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Modals and one-time popups state
  const [isGmRulesModalOpen, setIsGmRulesModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [hasSeenRules, setHasSeenRules] = useState(false);

  // --- Firebase Auth ---
  useEffect(() => {
    signInAnonymouslyIfNeeded()
      .then(() => setIsAuthenticating(false))
      .catch(() => {
        // Error is already alerted in the service. We can just stop loading.
        setIsAuthenticating(false);
      });
  }, []);
  
  // --- Online Multiplayer Logic ---

  // GM: Listen for messages from players and for presence changes
  useEffect(() => {
    if (gameMode !== 'online-gm' || !gameId) return;

    network.onMessage((message) => {
      if (message.type === 'PLAYER_JOIN_REQUEST') {
        if (players.length < MAX_PLAYERS && !players.find(p => p.id === message.payload.id)) {
          const newPlayer: Player = { id: message.payload.id, name: message.payload.name, lastSeenLogIndex: 0 };
          setPlayers(p => [...p, newPlayer]);

          if (gamePhase === 'play') {
            dispatch({
                type: 'ADD_LOG_ENTRY',
                payload: {
                    type: 'stat_change',
                    text: `(${message.payload.name}) Has Joined the Game!`
                }
            });
          }
        }
      } else if (message.type === 'LOBBY_CHAT_MESSAGE') {
        dispatch({ type: 'ADD_LOBBY_CHAT_MESSAGE', payload: message.payload.message });
      } else if (message.type === 'DISPATCH_ACTION') {
        dispatch(message.payload.action);
      } else if (message.type === 'END_TURN') {
        handleEndTurn();
      }
    });
    
    network.onPresenceChange(gameId, (leavingPlayerId, leavingPlayerName) => {
        const playerExists = players.some(p => p.id === leavingPlayerId);
        if (!playerExists) return; // Already processed

        dispatch({
            type: 'ADD_LOG_ENTRY',
            payload: {
                type: 'stat_change',
                text: `(${leavingPlayerName}) Has Left the Game!`
            }
        });

        const leavingPlayerIndex = players.findIndex(p => p.id === leavingPlayerId);
        const newPlayers = players.filter(p => p.id !== leavingPlayerId);
        setPlayers(newPlayers);

        // Adjust current player index if needed
        if (newPlayers.length > 0) {
            if (leavingPlayerIndex < currentPlayerIndex) {
                setCurrentPlayerIndex(prev => prev - 1);
            } else {
                setCurrentPlayerIndex(prev => prev % newPlayers.length);
            }
        } else {
            setCurrentPlayerIndex(0);
        }
    });

  }, [gameMode, gameId, players, currentPlayerIndex, gamePhase]); // Rerun if players list changes to have the latest closure

  // GM: Broadcast state changes
  useEffect(() => {
    if (gameMode !== 'online-gm') return;
    network.sendMessage({ 
      type: 'GAME_STATE_SYNC', 
      payload: { gameData, players, currentPlayerIndex, gamePhase } 
    });
  }, [gameMode, gameData, players, currentPlayerIndex, gamePhase]);

  // Player: Listen for state sync from GM
  useEffect(() => {
    if (gameMode !== 'online-player') return;

    const handleMessage = (message: network.NetworkMessage) => {
      if (message.type === 'GAME_STATE_SYNC') {
        // We got a message from the GM, we are connected.
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        setConnectionStatus('connected');
        
        const { gameData, players, currentPlayerIndex, gamePhase } = message.payload;
        dispatch({ type: 'SET_GAME_DATA', payload: gameData });
        setPlayers(players || []); // Guard against undefined players from Firebase
        setCurrentPlayerIndex(currentPlayerIndex || 0); // Guard as well
        setGamePhase(gamePhase);
      }
    };
    
    network.onMessage(handleMessage);

  }, [gameMode]);
  
  // Player: Show rules modal on first entry to 'play' phase
  useEffect(() => {
    if (gameMode === 'online-player' && gamePhase === 'play' && !hasSeenRules) {
        setIsGmRulesModalOpen(true);
        setHasSeenRules(true);
    }
  }, [gamePhase, gameMode, hasSeenRules]);

  // Lobby Music Playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const isGmLobby = (gameMode === 'online-gm' && gamePhase === 'setup' && !!gameId);
    const isPlayerWaiting = (gameMode === 'online-player' && gamePhase === 'setup');
    const shouldPlay = gameData.lobbyMusicUrl && (isGmLobby || isPlayerWaiting);
    
    if (shouldPlay) {
        if (audio.src !== gameData.lobbyMusicUrl) {
            audio.src = gameData.lobbyMusicUrl;
            audio.loop = true;
        }
        audio.play().catch(error => {
            console.warn("Lobby music autoplay was blocked by the browser.", error);
        });
    } else {
        audio.pause();
        if (audio.src) {
            audio.removeAttribute('src');
            audio.load();
        }
    }
  }, [gameData.lobbyMusicUrl, gameMode, gamePhase, gameId]);


  // --- Game Actions ---

  const onlineDispatch = (action: Action) => {
    if (gameMode === 'online-player') {
      network.sendMessage({ type: 'DISPATCH_ACTION', payload: { action } });
    } else {
      dispatch(action);
    }
  };

    const handleSendLobbyChatMessage = (messageText: string) => {
      const senderPlayer = players.find(p => p.id === myPlayerId);
      const senderName = (gameMode === 'online-gm' && !myPlayerId) ? 'Game Master' : senderPlayer?.name;
      const senderId = myPlayerId || 'gm-host';

      if (!senderName) return;

      const message: ChatMessage = {
          senderId: senderId,
          senderName: senderName,
          text: messageText,
          timestamp: Date.now()
      };
      
      if (gameMode === 'online-player') {
          network.sendMessage({ type: 'LOBBY_CHAT_MESSAGE', payload: { message } });
      } else if (gameMode === 'online-gm') {
          dispatch({ type: 'ADD_LOBBY_CHAT_MESSAGE', payload: message });
      }
  };

  const startLocalGame = async () => {
    setGameMode('local');
    await startGame();
  };

  const hostOnlineGame = (options: { asPlayer: boolean, playerName: string }) => {
    const { asPlayer, playerName } = options;
    const newGameId = String(Math.floor(100000 + Math.random() * 900000));
    setGameId(newGameId);
    setGameMode('online-gm');

    if (asPlayer && playerName.trim()) {
        const hostPlayerId = sessionId; // Use the unique session ID
        setMyPlayerId(hostPlayerId);
        const hostPlayer: Player = { id: hostPlayerId, name: playerName.trim(), lastSeenLogIndex: 0 };
        setPlayers([hostPlayer]);
        network.setupPresence(newGameId, hostPlayerId, playerName.trim());
    } else {
        setPlayers([]); // Start with no players for GM
        setMyPlayerId(null); // GM is not a player
    }

    network.createGameChannel(newGameId);
  };

  const joinOnlineGameAsPlayer = (id: string, name: string) => {
    setGameId(id);
    setGameMode('online-player');
    const playerId = sessionId;
    setMyPlayerId(playerId);
    network.joinGameChannel(id);
    network.setupPresence(id, playerId, name);
    
    setConnectionStatus('connecting');
    network.sendMessage({ type: 'PLAYER_JOIN_REQUEST', payload: { name, id: playerId } });

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    connectionTimeoutRef.current = window.setTimeout(() => {
        setConnectionStatus('failed');
        network.removePresence(id, playerId);
    }, 20000); // Increased to 20 seconds
  };

  const startGame = async () => {
    if (players.length < 1 && gameMode !== 'online-gm') { // GM can start with 0 players, but we'll disable the button.
      alert('You need at least one player to start.');
      return;
    }
    if (players.some(p => !p.name.trim())) {
      alert('All players must have a name before starting.');
      return;
    }
    if (gameData.characters.length <= 1) {
      return;
    }

    setIsLoading(true);
    
    const publishedAssets = gameData.assets.filter(a => a.isPublished);
    const preloadPromises = publishedAssets.map(asset => {
        return new Promise<void>((resolve) => {
            const img = new Image();
            img.src = asset.url;
            img.onload = () => resolve();
            img.onerror = () => {
                console.warn(`Failed to preload asset: ${asset.name} (${asset.url})`);
                resolve();
            };
        });
    });

    try {
        await Promise.all(preloadPromises);
    } catch (error) {
        console.error("Asset preloading failed:", error);
    }

    setIsLoading(false);
    setGamePhase('play');
    setCurrentPlayerIndex(0);
  };
  
  const handleEndTurn = () => {
    if (gameMode === 'online-player') {
      network.sendMessage({ type: 'END_TURN', payload: {} });
      return;
    }
    
    // Local/GM logic
    const newPlayers = [...players];
    if (newPlayers[currentPlayerIndex]) {
        newPlayers[currentPlayerIndex].lastSeenLogIndex = gameData.storyLog.length;
        setPlayers(newPlayers);
    }
    
    setCurrentPlayerIndex(prev => (prev + 1) % (players.length || 1));
  };
  
  const handleLeaveGame = () => {
      if (gameMode === 'online-player') {
          if (myPlayerId && gameId) {
              network.removePresence(gameId, myPlayerId);
          }
          window.location.reload();
      } else if (gameMode === 'online-gm' && myPlayerId && gameId) {
          const playerToRemove = players.find(p => p.id === myPlayerId);
          if (!playerToRemove) return;
          if (!window.confirm(`Are you sure you want to stop playing as ${playerToRemove.name}? You will become a spectator.`)) return;

          dispatch({ type: 'ADD_LOG_ENTRY', payload: { type: 'stat_change', text: `(${playerToRemove.name}) Has Left the Game!` } });
          
          const leavingPlayerIndex = players.findIndex(p => p.id === myPlayerId);
          const newPlayers = players.filter(p => p.id !== myPlayerId);
          setPlayers(newPlayers);

          if (newPlayers.length > 0) {
              if (leavingPlayerIndex < currentPlayerIndex) {
                  setCurrentPlayerIndex(prev => prev - 1);
              } else {
                  setCurrentPlayerIndex(prev => prev % newPlayers.length);
              }
          } else {
              setCurrentPlayerIndex(0);
          }

          network.removePresence(gameId, myPlayerId);
          setMyPlayerId(null);

      } else if (gameMode === 'local') {
          const playerToRemove = players[currentPlayerIndex];
          if (!playerToRemove) return;

          if (!window.confirm(`Are you sure you want ${playerToRemove.name} to leave the game?`)) return;

          dispatch({
              type: 'ADD_LOG_ENTRY',
              payload: {
                  type: 'stat_change',
                  text: `(${playerToRemove.name}) Has Left the Game!`
              }
          });
          
          const newPlayers = players.filter(p => p.id !== playerToRemove.id);
          setPlayers(newPlayers);

          // The current index will now point to the next player in the list.
          // If the last player leaves, the index becomes 0.
          setCurrentPlayerIndex(currentPlayerIndex % (newPlayers.length || 1));
      }
  };

  const returnToSetup = () => {
    window.location.reload();
  }

  const renderGamePhase = () => {
    if (gameMode === 'online-player' && connectionStatus === 'connecting') {
        return (
            <div className="bg-secondary p-6 rounded-lg text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-highlight mx-auto mb-4"></div>
                <h2 className="text-2xl text-highlight mb-4">Connecting to game...</h2>
                <p>Game ID: {gameId}</p>
            </div>
        )
    }

    if (gameMode === 'online-player' && connectionStatus === 'failed') {
        return (
            <div className="bg-secondary p-8 rounded-lg text-center max-w-lg mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-3xl font-bold text-red-400 mb-4">Connection Failed</h2>
                <p className="mb-4 text-lg">Could not connect to the game with ID: <span className="font-mono bg-primary px-2 py-1 rounded">{gameId}</span></p>
                <p className="text-gray-300 mb-8">Please check the Game ID and your internet connection, and ensure the host is waiting for players in the lobby.</p>
                <button onClick={() => window.location.reload()} className="px-6 py-3 bg-highlight text-white text-lg font-bold rounded-lg hover:bg-opacity-80 transition-transform hover:scale-105">
                  Back to Menu
                </button>
            </div>
        )
    }

    if (gameMode === 'online-player' && gamePhase === 'setup') {
        return (
            <div className="bg-secondary p-8 rounded-lg grid md:grid-cols-2 gap-8 items-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-highlight mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-highlight mb-4">Waiting for Host to Start...</h2>
                    <p className="mb-4">You have successfully joined the game. The host can see you in the lobby.</p>
                    <div className="bg-primary p-4 rounded-lg">
                        <p className="text-lg text-gray-400 mb-2">Game ID:</p>
                        <p className="text-2xl font-mono text-white">{gameId}</p>
                    </div>
                </div>
                <div className="h-[50vh]">
                    <LobbyChat
                        chatLog={gameData.lobbyChatLog}
                        onSendMessage={handleSendLobbyChatMessage}
                        canSendMessage={true}
                        title="Lobby Chat"
                    />
                </div>
            </div>
        );
    }

    switch(gamePhase) {
      case 'setup':
        return (
          <SetupView
            gameData={gameData}
            dispatch={dispatch}
            players={players}
            setPlayers={setPlayers}
            onStartLocalGame={startLocalGame}
            onHostOnlineGame={hostOnlineGame}
            onJoinOnlineGame={joinOnlineGameAsPlayer}
            gameId={gameId}
            onStartGameForEveryone={startGame}
            onSendLobbyMessage={handleSendLobbyChatMessage}
          />
        );
      case 'play':
        if (players.length === 0 && gameMode !== 'online-gm') {
            return (
                <div className="text-center p-8 bg-secondary rounded-lg">
                    <h2 className="text-2xl text-highlight mb-4">All players have left the game.</h2>
                    <button onClick={returnToSetup} className="px-4 py-2 bg-accent hover:bg-highlight text-white rounded-md transition-colors">
                      Return to Setup
                    </button>
                </div>
            )
        }
        return (
          <GameView 
            gameData={gameData}
            dispatch={onlineDispatch}
            players={players}
            currentPlayer={players[currentPlayerIndex]}
            currentPlayerIndex={currentPlayerIndex}
            onEndTurn={handleEndTurn}
            gameMode={gameMode}
            myPlayerId={myPlayerId}
          />
        );
    }
  }

  if (isAuthenticating) {
    return (
        <div className="fixed inset-0 bg-primary flex items-center justify-center z-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-highlight mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold">Connecting to Game Services...</h2>
            </div>
        </div>
    );
  }

  const isPlayerInGame = (gameMode === 'local' && players.length > 0) || (gameMode === 'online-player') || (gameMode === 'online-gm' && !!myPlayerId);


  return (
      <div className="min-h-screen bg-primary text-light font-sans p-4 relative">
          <audio ref={audioRef} />
          {isLoading && (
            <div className="fixed inset-0 bg-primary bg-opacity-90 flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-highlight mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold">Loading Assets...</h2>
                </div>
            </div>
          )}
          <div className="w-full max-w-7xl mx-auto">
              <header className="w-full flex justify-between items-center p-4 bg-secondary rounded-lg shadow-lg mb-4 border border-accent">
                <h1 className="text-3xl font-bold text-highlight">Visual Novel Forge</h1>
                <div className="flex items-center gap-4">
                  {gamePhase === 'play' && (
                    <>
                      <button onClick={() => setIsTutorialModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
                        Tutorial
                      </button>
                      <button onClick={() => setIsGmRulesModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors">
                        GM Rules
                      </button>
                    </>
                  )}
                  {isPlayerInGame && gamePhase === 'play' && (
                     <button onClick={handleLeaveGame} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors relative z-10">
                      Leave Game
                    </button>
                  )}
                  {(gameMode === 'local' || gameMode === 'online-gm') && gamePhase === 'play' && (
                    <button onClick={() => setIsGmMenuOpen(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors">
                      GM Actions
                    </button>
                  )}
                </div>
              </header>

              <main>
                {renderGamePhase()}
              </main>

              {(gameMode === 'local' || gameMode === 'online-gm') && gamePhase === 'play' && (
                <GMMenu
                    isOpen={isGmMenuOpen}
                    onClose={() => setIsGmMenuOpen(false)}
                    gameData={gameData}
                    dispatch={dispatch}
                    players={players}
                    setPlayers={setPlayers}
                    gameId={gameId}
                />
              )}
          </div>
          {isGmRulesModalOpen && <GmRulesModal rules={gameData.gmRules} onClose={() => setIsGmRulesModalOpen(false)} />}
          {isTutorialModalOpen && <TutorialModal onClose={() => setIsTutorialModalOpen(false)} />}
      </div>
  );
};

export default App;