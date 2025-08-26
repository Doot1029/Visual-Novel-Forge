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
  | { type: 'LOBBY_CHAT_MESSAGE'; payload: { message: ChatMessage } }
  // Custom message sent from the network service to the client when the game is deleted
  | { type: 'GAME_DELETED' };


let currentGameId: string | null = null;
let messageHandler: ((message: NetworkMessage) => void) | null = null;

// Keep track of Firebase listeners to detach them later
type Unsubscribe = () => void;
let stateListenerUnsubscribe: Unsubscribe | null = null;
let musicListenerUnsubscribe: Unsubscribe | null = null;
let actionsListenerUnsubscribe: Unsubscribe | null = null;
let presenceListenerUnsubscribe: Unsubscribe | null = null;
let typingListeners: Record<string, Unsubscribe> = {};
let onDisconnectRef: firebase.database.OnDisconnect | null = null;
const typingDisconnectRefs: Record<string, firebase.database.OnDisconnect> = {};


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
        if (!snapshot.exists()) { // This is key for handling kicked players/ID changes
            if (messageHandler) {
                messageHandler({ type: 'GAME_DELETED' });
            }
            return;
        }
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
 * Sets the typing status for a user in a specific chat.
 * @param gameId The game ID.
 * @param chatType 'lobby' or 'in-game'.
 * @param userId The user's unique ID.
 * @param userName The user's name.
 * @param isTyping Whether the user is typing or not.
 */
export const setTypingStatus = (gameId: string, chatType: 'lobby' | 'in-game', userId: string, userName: string, isTyping: boolean): void => {
    const typingRef = db.ref(`games/${gameId}/typing/${chatType}/${userId}`);
    if (isTyping) {
        typingDisconnectRefs[chatType] = typingRef.onDisconnect();
        typingDisconnectRefs[chatType].remove();
        typingRef.set({ name: userName });
    } else {
        if (typingDisconnectRefs[chatType]) {
            typingDisconnectRefs[chatType].cancel();
            delete typingDisconnectRefs[chatType];
        }
        typingRef.remove();
    }
};

/**
 * Subscribes to typing status changes for a specific chat.
 * @param gameId The game ID.
 * @param chatType 'lobby' or 'in-game'.
 * @param onTypingUsersChange Callback function with the list of typing users.
 */
export const onTypingStatusChange = (gameId: string, chatType: 'lobby' | 'in-game', onTypingUsersChange: (users: Record<string, string>) => void): void => {
    const typingPathRef = db.ref(`games/${gameId}/typing/${chatType}`);
    const typingUsers: Record<string, string> = {};

    const update = () => onTypingUsersChange({ ...typingUsers });

    const addedListener = (snapshot: firebase.database.DataSnapshot) => {
        const userId = snapshot.key;
        const userData = snapshot.val();
        if (userId && userData?.name) {
            typingUsers[userId] = userData.name;
            update();
        }
    };

    const removedListener = (snapshot: firebase.database.DataSnapshot) => {
        const userId = snapshot.key;
        if (userId) {
            delete typingUsers[userId];
            update();
        }
    };
    
    typingPathRef.on('child_added', addedListener);
    typingPathRef.on('child_removed', removedListener);

    typingListeners[chatType] = () => {
        typingPathRef.off('child_added', addedListener);
        typingPathRef.off('child_removed', removedListener);
    };
};


/**
 * Fetches the entire state of a game from Firebase. Used for GM rejoin.
 * @param gameId The game ID to fetch.
 */
export const fetchGameState = async (gameId: string): Promise<any> => {
    const snapshot = await db.ref(`games/${gameId}`).once('value');
    return snapshot.val();
}

/**
 * Creates a new game in Firebase with a predefined state. Used for regenerating game ID.
 * @param gameId The new game ID.
 * @param state The entire game state object to write.
 */
export const createGameWithState = (gameId: string, state: any): Promise<void> => {
    return db.ref(`games/${gameId}`).set(state);
}


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
    if (stateListenerUnsubscribe) stateListenerUnsubscribe();
    if (musicListenerUnsubscribe) musicListenerUnsubscribe();
    if (actionsListenerUnsubscribe) actionsListenerUnsubscribe();
    if (presenceListenerUnsubscribe) presenceListenerUnsubscribe();
    
    Object.values(typingListeners).forEach(unsub => unsub());
    typingListeners = {};

    if (onDisconnectRef) onDisconnectRef.cancel();
    Object.values(typingDisconnectRefs).forEach(ref => ref.cancel());
    
    stateListenerUnsubscribe = null;
    musicListenerUnsubscribe = null;
    actionsListenerUnsubscribe = null;
    presenceListenerUnsubscribe = null;
    onDisconnectRef = null;
    currentGameId = null;
};