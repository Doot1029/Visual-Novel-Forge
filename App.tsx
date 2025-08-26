
import React, { useState, useReducer, useCallback, useEffect, useRef } from 'react';
import { GameData, Player, GamePhase, Character, Asset, GameMode, ChatMessage, SavedSession } from './types';
import { gameReducer, Action } from './state/reducer';
import { INITIAL_GAME_DATA } from './constants';
import SetupView from './components/SetupView';
import { GameView } from './components/GameView';
import GMMenu from './components/GMMenu';
import GmRulesModal from './components/GmRulesModal';
import TutorialModal from './components/TutorialModal';
import LobbyChat from './components/LobbyChat';
import * as network from './services/networkService';
import { MAX_PLAYERS } from './constants';
import { signInAnonymouslyIfNeeded } from './services/firebase';
import ChangelogModal from './components/ChangelogModal';
import { getLatestVersionFromChangelog } from './changelogData';

interface ImagePreviewModalProps {
  asset: Asset | null;
  onClose: () => void;
}

const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue];
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ asset, onClose }) => {
    if (!asset) return null;
    return (
        <div 
            className="fixed inset-0 bg-primary bg-opacity-95 z-[100] flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
            onClick={onClose} 
        >
            <div 
                className="bg-secondary rounded-lg shadow-2xl w-full max-w-4xl flex flex-col relative border-2 border-accent"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-accent">
                    <h2 className="text-xl font-bold text-highlight">{asset.name}</h2>
                    <button onClick={onClose} className="text-light hover:text-highlight text-3xl font-bold" aria-label="Close Image Preview">×</button>
                </div>
                <div className="p-4 flex-1 overflow-hidden flex items-center justify-center">
                    <img src={asset.url} alt={asset.name} className="max-w-full max-h-[75vh] object-contain" />
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [gameData, dispatch] = useReducer(gameReducer, { ...INITIAL_GAME_DATA, players: [] });
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
  const [isKicked, setIsKicked] = useState(false);

  const [isGmRulesModalOpen, setIsGmRulesModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [hasSeenRules, setHasSeenRules] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const { players } = gameData;
  const [lobbyTypingUsers, setLobbyTypingUsers] = useState<Record<string, string>>({});
  const [gameTypingUsers, setGameTypingUsers] = useState<Record<string, string>>({});

  const [savedSessions, setSavedSessions] = useLocalStorage<SavedSession[]>('vns-sessions', []);

  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [lastSeenVersion, setLastSeenVersion] = useLocalStorage<string | null>('vns-last-seen-version', null);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  
  const [fatalError, setFatalError] = useState<{ message: string; filename: string; lineno: number; colno: number } | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
        if (event.message.includes("ResizeObserver")) {
            console.warn("Ignored non-critical ResizeObserver error.");
            return;
        }
        event.preventDefault();
        setFatalError({
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
        });
    };
    window.addEventListener('error', handleError);
    return () => {
        window.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('./version.json?cache_bust=' + new Date().getTime());
        if (!response.ok) {
          console.warn('Could not fetch version.json');
          return;
        }
        const data = await response.json();
        const currentVersion = data.version;

        if (appVersion === null) { // First time loading the app in this session
          setAppVersion(currentVersion);
          // Check if this version is new for the user since their last visit
          if (lastSeenVersion !== currentVersion) {
              setIsChangelogModalOpen(true);
              setLastSeenVersion(currentVersion);
          }
        } else if (appVersion !== currentVersion) { // A new version was deployed while app was open
          setNewVersionAvailable(true);
        }
      } catch (error) {
        console.error('Error checking for new version:', error);
      }
    };

    checkVersion();
    const intervalId = setInterval(checkVersion, 60000); 

    return () => clearInterval(intervalId);
  }, [appVersion, lastSeenVersion, setLastSeenVersion]);

  useEffect(() => {
    signInAnonymouslyIfNeeded()
      .then(() => setIsAuthenticating(false))
      .catch(() => {
        setIsAuthenticating(false);
      });
  }, []);
  
  useEffect(() => {
    if (gameMode !== 'online-gm' || !gameId) return;

    network.onMessage((message) => {
      if (message.type === 'PLAYER_JOIN_REQUEST') {
          if (gameData.players.some(p => p.name.toLowerCase() === message.payload.name.toLowerCase())) {
              const logAction: Action = { type: 'ADD_LOBBY_CHAT_MESSAGE', payload: {
                  senderId: 'system',
                  senderName: 'System',
                  text: `'${message.payload.name}' tried to join, but the name is already in use. Join request rejected.`,
                  timestamp: Date.now()
              }};
              dispatch(logAction);
              return;
          }
          const newPlayer: Player = { id: message.payload.id, name: message.payload.name, lastSeenLogIndex: 0, coins: 0 };
          dispatch({ type: 'ADD_PLAYER', payload: newPlayer });
          if (gamePhase === 'play') {
            dispatch({
                type: 'ADD_LOG_ENTRY',
                payload: {
                    type: 'stat_change',
                    text: `(${message.payload.name}) Has Joined the Game!`
                }
            });
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
        const playerExists = gameData.players.some(p => p.id === leavingPlayerId);
        if (!playerExists) return;

        dispatch({
            type: 'ADD_LOG_ENTRY',
            payload: {
                type: 'stat_change',
                text: `(${leavingPlayerName}) Has Left the Game!`
            }
        });

        const leavingPlayerIndex = gameData.players.findIndex(p => p.id === leavingPlayerId);
        dispatch({ type: 'REMOVE_PLAYER', payload: { id: leavingPlayerId } });
        
        setCurrentPlayerIndex(prev => {
            const newPlayerCount = gameData.players.length - 1;
            if (newPlayerCount <= 0) return 0;
            if (leavingPlayerIndex < prev) return prev - 1;
            return prev % newPlayerCount;
        });
    });

  }, [gameMode, gameId, gameData.players, currentPlayerIndex, gamePhase]);

  useEffect(() => {
    if (gameMode !== 'online-gm') return;
    network.sendMessage({ 
      type: 'GAME_STATE_SYNC', 
      payload: { gameData, players: gameData.players, currentPlayerIndex, gamePhase } 
    });
  }, [gameMode, gameData, currentPlayerIndex, gamePhase]);

  useEffect(() => {
    if (gameMode !== 'online-player' || !gameId) return;

    const handleMessage = (message: network.NetworkMessage) => {
      if (message.type === 'GAME_STATE_SYNC') {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        setConnectionStatus('connected');
        
        const { gameData: newGameData, currentPlayerIndex: newCurrentPlayerIndex, gamePhase: newGamePhase } = message.payload;
        
        if (myPlayerId && !newGameData.players.some(p => p.id === myPlayerId)) {
            setIsKicked(true);
            network.closeChannel();
            return;
        }

        dispatch({ type: 'SET_GAME_DATA', payload: newGameData });
        setCurrentPlayerIndex(newCurrentPlayerIndex || 0);
        setGamePhase(newGamePhase);

        const currentSession = savedSessions.find(s => s.gameId === gameId);
        if (currentSession && currentSession.title !== newGameData.title) {
            setSavedSessions(prev => prev.map(s => s.gameId === gameId ? {...s, title: newGameData.title} : s));
        }
      } else if (message.type === 'GAME_DELETED') {
          alert("You have been disconnected. The Game ID may have been changed by the GM, or the game was deleted.");
          handleLeaveSession(gameId, true);
          window.location.reload();
          return;
      }
    };
    
    network.onMessage(handleMessage);

  }, [gameMode, gameId, savedSessions, setSavedSessions, myPlayerId]);

  useEffect(() => {
      if (gameId && (gameMode === 'online-gm' || gameMode === 'online-player')) {
          network.onTypingStatusChange(gameId, 'lobby', setLobbyTypingUsers);
          network.onTypingStatusChange(gameId, 'in-game', setGameTypingUsers);
      }
  }, [gameId, gameMode]);
  
  useEffect(() => {
    if (gameMode === 'online-player' && gamePhase === 'play' && !hasSeenRules) {
        setIsGmRulesModalOpen(true);
        setHasSeenRules(true);
    }
  }, [gamePhase, gameMode, hasSeenRules]);

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


  const onlineDispatch = (action: Action) => {
    if (gameMode === 'online-player') {
      network.sendMessage({ type: 'DISPATCH_ACTION', payload: { action } });
    } else {
      dispatch(action);
    }
  };

    const getMyPlayerInfo = useCallback(() => {
        if (gameMode === 'online-gm' && !myPlayerId) {
            return { id: 'gm-host', name: 'Game Master' };
        }
        if (myPlayerId) {
            const me = gameData.players.find(p => p.id === myPlayerId);
            return me ? { id: me.id, name: me.name } : null;
        }
        return null;
    }, [gameMode, myPlayerId, gameData.players]);

    const handleSendLobbyChatMessage = (messageText: string) => {
      const me = getMyPlayerInfo();
      if (!me) return;

      const message: ChatMessage = { senderId: me.id, senderName: me.name, text: messageText, timestamp: Date.now() };
      
      if (gameMode === 'online-player') {
          network.sendMessage({ type: 'LOBBY_CHAT_MESSAGE', payload: { message } });
      } else if (gameMode === 'online-gm') {
          dispatch({ type: 'ADD_LOBBY_CHAT_MESSAGE', payload: message });
      }
    };

  const handleTypingChange = (chatType: 'lobby' | 'in-game') => (isTyping: boolean) => {
      if (!gameId) return;
      const me = getMyPlayerInfo();
      if (!me) return;
      network.setTypingStatus(gameId, chatType, me.id, me.name, isTyping);
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

    let hostPlayerId: string | null = null;
    if (asPlayer && playerName.trim()) {
        hostPlayerId = sessionId;
        setMyPlayerId(hostPlayerId);
        const hostPlayer: Player = { id: hostPlayerId, name: playerName.trim(), lastSeenLogIndex: 0, coins: 0 };
        dispatch({type: 'SET_PLAYERS', payload: [hostPlayer]});
        network.setupPresence(newGameId, hostPlayerId, playerName.trim());
    } else {
        dispatch({type: 'SET_PLAYERS', payload: []});
        setMyPlayerId(null);
    }

    network.createGameChannel(newGameId);
    
    const newSession: SavedSession = {
        gameId: newGameId,
        title: gameData.title,
        role: 'gm',
        myPlayerId: hostPlayerId,
        myPlayerName: playerName.trim(),
        lastAccessed: Date.now(),
    };
    setSavedSessions(prev => [newSession, ...prev.filter(s => s.gameId !== newGameId)]);
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

    const newSession: SavedSession = {
        gameId: id,
        title: `Joining "${id}"...`,
        role: 'player',
        myPlayerId: playerId,
        myPlayerName: name,
        lastAccessed: Date.now(),
    };
    setSavedSessions(prev => [newSession, ...prev.filter(s => s.gameId !== id)]);

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    connectionTimeoutRef.current = window.setTimeout(() => {
        setConnectionStatus('failed');
        network.removePresence(id, playerId);
    }, 20000);
  };

  const startGame = async () => {
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
    
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer) {
        const updatedPlayer = {...currentPlayer, lastSeenLogIndex: gameData.storyLog.length};
        dispatch({type: 'UPDATE_PLAYER', payload: updatedPlayer});
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
          dispatch({ type: 'REMOVE_PLAYER', payload: { id: myPlayerId } });
          const newPlayerCount = players.length - 1;

          if (newPlayerCount > 0) {
              if (leavingPlayerIndex < currentPlayerIndex) {
                  setCurrentPlayerIndex(prev => prev - 1);
              } else {
                  setCurrentPlayerIndex(prev => prev % newPlayerCount);
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
          
          dispatch({ type: 'REMOVE_PLAYER', payload: { id: playerToRemove.id } });
          const newPlayerCount = players.length - 1;
          setCurrentPlayerIndex(currentPlayerIndex % (newPlayerCount || 1));
      }
  };

    const handleRejoinSession = async (session: SavedSession) => {
        if (session.role === 'gm') {
            setIsLoading(true);
            try {
                const remoteState = await network.fetchGameState(session.gameId);
                if (!remoteState) {
                    alert("This game session could not be found. It may have been deleted.");
                    handleDeleteSession(session.gameId, true);
                    return;
                }
                
                const { gameData: remoteGameData, currentPlayerIndex: remotePlayerIndex, gamePhase: remoteGamePhase } = remoteState.state;
                
                const finalGameData = { ...remoteGameData, lobbyMusicUrl: remoteState.music?.lobbyMusicUrl || null };
                
                dispatch({ type: 'SET_GAME_DATA', payload: finalGameData });
                setCurrentPlayerIndex(remotePlayerIndex || 0);
                setGamePhase(remoteGamePhase);

                setGameId(session.gameId);
                setGameMode('online-gm');
                setMyPlayerId(session.myPlayerId || null);

                network.createGameChannel(session.gameId);
                if (session.myPlayerId && session.myPlayerName) {
                    network.setupPresence(session.gameId, session.myPlayerId, session.myPlayerName);
                }
                
                setSavedSessions(prev => prev.map(s => s.gameId === session.gameId ? {...s, lastAccessed: Date.now()} : s));

            } catch (error) {
                alert(`Error rejoining game: ${error instanceof Error ? error.message : "An unknown error occurred."}`);
            } finally {
                setIsLoading(false);
            }

        } else if (session.role === 'player' && session.myPlayerId && session.myPlayerName) {
            joinOnlineGameAsPlayer(session.gameId, session.myPlayerName);
        }
    };

    const handleLeaveSession = (gameIdToRemove: string, silent = false) => {
        const performLeave = () => {
            setSavedSessions(prev => prev.filter(s => s.gameId !== gameIdToRemove));
        };
        if (silent) {
            performLeave();
        } else if (window.confirm("Are you sure you want to leave this game? This will only remove it from your dashboard.")) {
            performLeave();
        }
    };
    
    const handleDeleteSession = (gameIdToDelete: string, silent = false) => {
        const performDelete = () => {
            network.deleteGame(gameIdToDelete)
                .then(() => {
                    if (!silent) alert(`Game ${gameIdToDelete} has been deleted.`);
                    setSavedSessions(prev => prev.filter(s => s.gameId !== gameIdToDelete));
                })
                .catch(error => {
                    if (!silent) alert(`Failed to delete game: ${error.message}`);
                    console.error("Failed to delete game:", error);
                });
        };

        if (silent) {
            performDelete();
        } else if (window.confirm("Are you the Game Master. Are you sure you want to PERMANENTLY delete this game for ALL players? This cannot be undone.")) {
            performDelete();
        }
    };

    const handleKickPlayer = (playerIdToKick: string) => {
        const playerToKick = gameData.players.find(p => p.id === playerIdToKick);
        if (!playerToKick || gameMode !== 'online-gm') return;
        
        dispatch({
            type: 'ADD_LOG_ENTRY',
            payload: { type: 'stat_change', text: `${playerToKick.name} was kicked by the GM.` }
        });
        
        const kickedPlayerIndex = gameData.players.findIndex(p => p.id === playerIdToKick);

        dispatch({ type: 'REMOVE_PLAYER', payload: { id: playerIdToKick } });
        
        setCurrentPlayerIndex(prev => {
            const newPlayerCount = gameData.players.length - 1;
            if (newPlayerCount <= 0) return 0;
            if (kickedPlayerIndex < prev) return prev - 1;
            return prev % newPlayerCount;
        });
    };

  const returnToSetup = () => {
    window.location.reload();
  }

  const renderGamePhase = () => {
    if (isKicked) {
        return (
            <div className="bg-secondary p-8 rounded-lg text-center max-w-lg mx-auto">
                 <h2 className="text-3xl font-bold text-red-400 mb-4">You have been kicked.</h2>
                 <p className="mb-8 text-lg">You were removed from the game by the host.</p>
                 <button onClick={() => window.location.reload()} className="px-6 py-3 bg-highlight text-white text-lg font-bold rounded-lg hover:bg-opacity-80">
                  Return to Menu
                </button>
            </div>
        );
    }
    
    if (gameMode === 'online-player' && connectionStatus === 'connecting') {
        return (
            <div className="bg-secondary p-8 rounded-lg text-center max-w-lg mx-auto">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-highlight mx-auto mb-6"></div>
                <h2 className="text-3xl font-bold text-light mb-4">Connecting...</h2>
                <p className="text-lg text-gray-400">Attempting to join game: <span className="font-mono text-highlight">{gameId}</span></p>
            </div>
        );
    }
    
    if (gameMode === 'online-player' && connectionStatus === 'failed') {
        return (
            <div className="bg-secondary p-8 rounded-lg text-center max-w-lg mx-auto">
                 <h2 className="text-3xl font-bold text-red-400 mb-4">Connection Failed</h2>
                 <p className="mb-8 text-lg">Could not connect to the game. Please check the Game ID and your internet connection. The host may not be available.</p>
                 <button onClick={() => window.location.reload()} className="px-6 py-3 bg-highlight text-white text-lg font-bold rounded-lg hover:bg-opacity-80">
                  Return to Menu
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="bg-secondary p-8 rounded-lg text-center max-w-lg mx-auto">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-highlight mx-auto mb-6"></div>
                <h2 className="text-3xl font-bold text-light mb-4">Loading Game...</h2>
                <p className="text-lg text-gray-400">Pre-loading assets, please wait.</p>
            </div>
        );
    }
    
    switch (gamePhase) {
      case 'setup':
        return <SetupView 
            gameData={gameData} 
            dispatch={dispatch} 
            onStartLocalGame={startLocalGame}
            onHostOnlineGame={hostOnlineGame}
            onJoinOnlineGame={joinOnlineGameAsPlayer}
            gameId={gameId}
            onStartGameForEveryone={startGame}
            onSendLobbyMessage={handleSendLobbyChatMessage}
            onPreviewAsset={(asset) => setPreviewAsset(asset)}
            savedSessions={savedSessions}
            onRejoinSession={handleRejoinSession}
            onLeaveSession={handleLeaveSession}
            onDeleteSession={handleDeleteSession}
            typingUsers={lobbyTypingUsers}
            myPlayerId={myPlayerId}
            onTypingChange={handleTypingChange('lobby')}
         />;
      case 'play':
        const currentPlayer = players[currentPlayerIndex];
        return (
            <GameView
                gameData={gameData}
                dispatch={onlineDispatch}
                currentPlayer={currentPlayer}
                currentPlayerIndex={currentPlayerIndex}
                onEndTurn={handleEndTurn}
                gameMode={gameMode}
                myPlayerId={myPlayerId}
                typingUsers={gameTypingUsers}
                onTypingChange={handleTypingChange('in-game')}
            />
        );
      default:
        return <div>Unknown game phase</div>;
    }
  };
  
  const isSpectatingGm = gameMode === 'online-gm' && !myPlayerId;
  const canOpenGmMenu = gamePhase === 'play' && (gameMode === 'local' || gameMode === 'online-gm');
  const canLeaveGame = gamePhase === 'play' && (
      gameMode === 'local' || 
      (gameMode === 'online-player' && myPlayerId) || 
      (gameMode === 'online-gm' && myPlayerId)
  );

  if (isAuthenticating) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-highlight"></div>
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 relative">
        {fatalError && (
            <div className="fixed inset-0 bg-primary bg-opacity-95 z-[200] flex items-center justify-center p-4" aria-modal="true" role="alertdialog">
                <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border-2 border-red-500">
                    <div className="flex justify-between items-center p-4 border-b border-red-500">
                        <h2 className="text-2xl font-bold text-red-400">An Unexpected Error Occurred</h2>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[60vh]">
                        <p className="text-light mb-4">The application has encountered a problem and cannot continue. Please refresh the page. The technical details below can help with debugging.</p>
                        <pre className="bg-primary p-4 rounded-md text-sm text-red-300 whitespace-pre-wrap font-mono">
                            {`Message: ${fatalError.message}\nFile: ${fatalError.filename}\nLine: ${fatalError.lineno}, Column: ${fatalError.colno}`}
                        </pre>
                    </div>
                    <div className="p-4 border-t border-accent text-right">
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-6 py-2 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        )}
        {newVersionAvailable && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-highlight text-white p-3 rounded-lg text-center z-[200] shadow-lg flex items-center justify-center gap-4 animate-pulse">
                <p className="font-semibold">A new version is available!</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-1 bg-white text-highlight font-bold rounded-lg hover:bg-opacity-90"
                >
                  Refresh Now
                </button>
            </div>
        )}
        <header className="text-center mb-6">
            <h1 className="text-4xl font-bold text-highlight tracking-wider">{gameData.title}</h1>
            <p className="text-lg text-gray-300">A Collaborative Storytelling Game</p>
             <div className="absolute top-0 right-0 p-2 flex gap-2">
                <button onClick={() => setIsChangelogModalOpen(true)} className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 rounded-md font-bold">What's New</button>
                {canOpenGmMenu && <button onClick={() => setIsGmMenuOpen(true)} className="px-4 py-2 text-sm bg-accent hover:bg-opacity-75 rounded-md font-bold">GM Actions</button>}
                {canLeaveGame && <button onClick={handleLeaveGame} className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 rounded-md font-bold">Leave Game</button>}
                {gamePhase === 'play' && <button onClick={returnToSetup} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md font-bold">Return to Menu</button>}
                <button onClick={() => setIsTutorialModalOpen(true)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md font-bold">How to Play</button>
            </div>
        </header>

        <main>
            {renderGamePhase()}
        </main>
        
        {isGmRulesModalOpen && <GmRulesModal rules={gameData.gmRules} onClose={() => setIsGmRulesModalOpen(false)} />}
        {isTutorialModalOpen && <TutorialModal onClose={() => setIsTutorialModalOpen(false)} />}
        {previewAsset && <ImagePreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />}
        {isChangelogModalOpen && <ChangelogModal onClose={() => setIsChangelogModalOpen(false)} currentDisplayVersion={getLatestVersionFromChangelog()} />}

        {canOpenGmMenu && (
             <GMMenu 
                isOpen={isGmMenuOpen}
                onClose={() => setIsGmMenuOpen(false)}
                gameData={gameData}
                dispatch={dispatch}
                gameId={gameId}
                onPreviewAsset={(asset) => setPreviewAsset(asset)}
                onKickPlayer={handleKickPlayer}
             />
        )}
        <audio ref={audioRef} />
    </div>
  );
};

export default App;