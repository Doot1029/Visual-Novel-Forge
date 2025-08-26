import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import { GameData, Player, GamePhase, ChatMessage } from '../types';
import { Action } from '../state/reducer';
import { db } from './firebase';


// --- Message Types for Network Communication ---
export type NetworkMessage =
  // Sent by a player when they first try to join a game
  | { type: 'PLAYER_JOIN_REQUEST'; payload: { name: string; id: string } }
  // Sent by the GM to all players to synchronize the entire game state
  | { type: 'GAME_STATE_SYNC'; payload: { gameData: GameData; players: Player[]; currentPlayerIndex: number, gamePhase: GamePhase } }
  // Sent by a player to the GM to perform a game action
  | { type: 'DISPATCH_ACTION'; payload: { action: Action } }
  // Sent by a player to the GM to signal the end of their turn
  | { type: 'END_TURN'; payload: {} }
  // Sent by a player or GM during the setup/lobby phase
  | { type: 'LOBBY_CHAT_MESSAGE'; payload: { message: ChatMessage } };


let currentGameId: string | null = null;
let messageHandler: ((message: NetworkMessage) => void) | null = null;

// Keep track of Firebase listeners to detach them later
type Unsubscribe = () => void;
let stateListenerUnsubscribe: Unsubscribe | null = null;
let musicListenerUnsubscribe: Unsubscribe | null = null;
let actionsListenerUnsubscribe: Unsubscribe | null = null;
let presenceListenerUnsubscribe: Unsubscribe | null = null;
let onDisconnectRef: firebase.database.OnDisconnect | null = null;


/**
 * Sets up a listener to handle incoming messages from the channel.
 * This MUST be called before createGameChannel or joinGameChannel.
 * @param handler A callback function to process received messages.
 */
export const onMessage = (handler: (message: NetworkMessage) => void): void => {
    messageHandler = handler;
};


/**
 * Creates a new game channel and listens for player actions. (GM only)
 * @param gameId A unique identifier for the game session.
 */
export const createGameChannel = (gameId: string): void => {
    closeChannel(); // Ensure any previous listeners are cleared
    currentGameId = gameId;

    const actionsPathRef = db.ref(`games/${gameId}/actions`);
    
    // Listen for new actions from players
    const listener = (snapshot: firebase.database.DataSnapshot) => {
        if (messageHandler && snapshot.exists()) {
            messageHandler(snapshot.val() as NetworkMessage);
        }
    };
    actionsPathRef.on('child_added', listener);
    actionsListenerUnsubscribe = () => actionsPathRef.off('child_added', listener);
};

/**
 * Joins an existing game channel and listens for state updates. (Player only)
 * @param gameId The identifier of the game session to join.
 */
export const joinGameChannel = (gameId: string): void => {
    closeChannel(); // Ensure any previous listeners are cleared
    currentGameId = gameId;

    const statePathRef = db.ref(`games/${gameId}/state`);
    const musicPathRef = db.ref(`games/${gameId}/music`);

    let mainState: any = null;
    let musicData: any = null;

    const combineAndDispatch = () => {
        if (mainState && messageHandler) {
            const combinedPayload = { ...mainState };
            if (musicData && musicData.lobbyMusicUrl) {
                if (!combinedPayload.gameData) {
                    combinedPayload.gameData = {};
                }
                combinedPayload.gameData.lobbyMusicUrl = musicData.lobbyMusicUrl;
            } else if (combinedPayload.gameData) {
                combinedPayload.gameData.lobbyMusicUrl = null;
            }
            messageHandler({ type: 'GAME_STATE_SYNC', payload: combinedPayload });
        }
    };

    // Listen for main state updates from the GM
    const stateListener = (snapshot: firebase.database.DataSnapshot) => {
        const stateSyncPayload = snapshot.val();
        if (stateSyncPayload) {
            mainState = stateSyncPayload;
            combineAndDispatch();
        }
    };
    statePathRef.on('value', stateListener);
    stateListenerUnsubscribe = () => statePathRef.off('value', stateListener);

    // Listen for music updates separately
    const musicListener = (snapshot: firebase.database.DataSnapshot) => {
        musicData = snapshot.val();
        // Only need to re-dispatch if mainState is already loaded.
        // Otherwise, the state listener will handle the combined dispatch.
        if (mainState) {
            combineAndDispatch();
        }
    };
    musicPathRef.on('value', musicListener);
    musicListenerUnsubscribe = () => musicPathRef.off('value', musicListener);
};

/**
 * Sends a message over the network.
 * If the message is a GAME_STATE_SYNC, it's from the GM updating the state.
 * It will split the music data from the main state to avoid large payloads.
 * Otherwise, it's a player action being sent to the GM.
 * @param message The network message to send.
 */
export const sendMessage = (message: NetworkMessage): void => {
    if (!currentGameId) {
        console.error("Network channel is not initialized. Cannot send message.");
        return;
    }
    
    const handleError = (error: any) => {
        console.error("Failed to send message to Firebase:", error);
        alert(`Network Error: Could not send data to the game. This might be due to a large asset file (like music) or a connection issue. The host may need to restart the lobby.\n\nDetails: ${error.message}`);
    };

    if (message.type === 'GAME_STATE_SYNC') {
        // GM is sending a state update. We split it to avoid large payloads.
        const { gameData, ...restOfPayload } = message.payload;
        const { lobbyMusicUrl, ...restOfGameData } = gameData;

        // Write main state without music
        const statePathRef = db.ref(`games/${currentGameId}/state`);
        const mainStatePayload = { gameData: restOfGameData, ...restOfPayload };
        statePathRef.set(mainStatePayload).catch(handleError);

        // Write music data separately
        const musicPathRef = db.ref(`games/${currentGameId}/music`);
        musicPathRef.set({ lobbyMusicUrl: lobbyMusicUrl || null }).catch(handleError);
    } else {
        // Player is sending an action to the GM
        const actionsPathRef = db.ref(`games/${currentGameId}/actions`);
        actionsPathRef.push(message).catch(handleError);
    }
};

/**
 * Sets up a player's online presence, automatically removing them on disconnect.
 * @param gameId The game ID.
 * @param playerId The player's unique ID.
 * @param playerName The player's name.
 */
export const setupPresence = (gameId: string, playerId: string, playerName: string): void => {
    const presencePathRef = db.ref(`games/${gameId}/presence/${playerId}`);
    // Set up the onDisconnect handler
    onDisconnectRef = presencePathRef.onDisconnect();
    onDisconnectRef.remove();
    // Set the initial presence data
    presencePathRef.set({ name: playerName });
};

/**
 * Manually removes a player's presence data, e.g., when leaving voluntarily.
 * @param gameId The game ID.
 * @param playerId The player's unique ID.
 */
export const removePresence = (gameId: string, playerId: string): void => {
    // Cancel the pending onDisconnect operation
    if (onDisconnectRef) {
        onDisconnectRef.cancel();
        onDisconnectRef = null;
    }
    const presencePathRef = db.ref(`games/${gameId}/presence/${playerId}`);
    presencePathRef.remove();
};

/**
 * Listens for players leaving the game (GM only).
 * @param gameId The game ID.
 * @param onLeave Callback function when a player leaves.
 */
export const onPresenceChange = (gameId: string, onLeave: (id: string, name: string) => void) => {
    const presencePathRef = db.ref(`games/${gameId}/presence`);
    
    if (presenceListenerUnsubscribe) {
        presenceListenerUnsubscribe();
    }
    
    const listener = (snapshot: firebase.database.DataSnapshot) => {
        const playerId = snapshot.key;
        const playerData = snapshot.val();
        if (playerId && playerData?.name) {
            onLeave(playerId, playerData.name);
        }
    };
    presencePathRef.on('child_removed', listener);
    presenceListenerUnsubscribe = () => presencePathRef.off('child_removed', listener);
};

/**
 * Permanently deletes an entire game session from the database (GM only).
 * @param gameId The game ID to delete.
 */
export const deleteGame = (gameId: string): Promise<void> => {
    const gameRef = db.ref(`games/${gameId}`);
    return gameRef.remove();
}


/**
 * Closes the connection and detaches all Firebase listeners.
 */
export const closeChannel = (): void => {
    if (stateListenerUnsubscribe) {
        stateListenerUnsubscribe();
        stateListenerUnsubscribe = null;
    }
    if (musicListenerUnsubscribe) {
        musicListenerUnsubscribe();
        musicListenerUnsubscribe = null;
    }
    if (actionsListenerUnsubscribe) {
        actionsListenerUnsubscribe();
        actionsListenerUnsubscribe = null;
    }
    if (presenceListenerUnsubscribe) {
        presenceListenerUnsubscribe();
        presenceListenerUnsubscribe = null;
    }
    if (onDisconnectRef) {
        onDisconnectRef.cancel();
        onDisconnectRef = null;
    }
    currentGameId = null;
    // Don't reset the message handler, as it's set by React components
};