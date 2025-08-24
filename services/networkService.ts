import { ref, onChildAdded, onValue, set, push, Unsubscribe, onDisconnect, onChildRemoved, remove } from 'firebase/database';
import { GameData, Player, GamePhase } from '../types';
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
  | { type: 'END_TURN'; payload: {} };


let currentGameId: string | null = null;
let messageHandler: ((message: NetworkMessage) => void) | null = null;

// Keep track of Firebase listeners to detach them later
let stateListenerUnsubscribe: Unsubscribe | null = null;
let actionsListenerUnsubscribe: Unsubscribe | null = null;
let presenceListenerUnsubscribe: Unsubscribe | null = null;
let onDisconnectRef: any = null;


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

    const actionsPathRef = ref(db, `games/${gameId}/actions`);
    
    // Listen for new actions from players
    actionsListenerUnsubscribe = onChildAdded(actionsPathRef, (snapshot) => {
        if (messageHandler && snapshot.exists()) {
            messageHandler(snapshot.val() as NetworkMessage);
        }
    });
};

/**
 * Joins an existing game channel and listens for state updates. (Player only)
 * @param gameId The identifier of the game session to join.
 */
export const joinGameChannel = (gameId: string): void => {
    closeChannel(); // Ensure any previous listeners are cleared
    currentGameId = gameId;

    const statePathRef = ref(db, `games/${gameId}/state`);
    
    // Listen for state updates from the GM
    stateListenerUnsubscribe = onValue(statePathRef, (snapshot) => {
        const stateSyncPayload = snapshot.val();
        if (stateSyncPayload && messageHandler) {
            messageHandler({ type: 'GAME_STATE_SYNC', payload: stateSyncPayload });
        }
    });
};

/**
 * Sends a message over the network.
 * If the message is a GAME_STATE_SYNC, it's from the GM updating the state.
 * Otherwise, it's a player action being sent to the GM.
 * @param message The network message to send.
 */
export const sendMessage = (message: NetworkMessage): void => {
    if (!currentGameId) {
        console.error("Network channel is not initialized. Cannot send message.");
        return;
    }

    if (message.type === 'GAME_STATE_SYNC') {
        // GM is sending a state update for all players
        const statePathRef = ref(db, `games/${currentGameId}/state`);
        set(statePathRef, message.payload);
    } else {
        // Player is sending an action to the GM
        const actionsPathRef = ref(db, `games/${currentGameId}/actions`);
        push(actionsPathRef, message); // `push` generates a unique key for each action
    }
};

/**
 * Sets up a player's online presence, automatically removing them on disconnect.
 * @param gameId The game ID.
 * @param playerId The player's unique ID.
 * @param playerName The player's name.
 */
export const setupPresence = (gameId: string, playerId: string, playerName: string): void => {
    const presencePathRef = ref(db, `games/${gameId}/presence/${playerId}`);
    // Set up the onDisconnect handler
    onDisconnectRef = onDisconnect(presencePathRef);
    onDisconnectRef.remove();
    // Set the initial presence data
    set(presencePathRef, { name: playerName });
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
    const presencePathRef = ref(db, `games/${gameId}/presence/${playerId}`);
    remove(presencePathRef);
};

/**
 * Listens for players leaving the game (GM only).
 * @param gameId The game ID.
 * @param onLeave Callback function when a player leaves.
 */
export const onPresenceChange = (gameId: string, onLeave: (id: string, name: string) => void) => {
    const presencePathRef = ref(db, `games/${gameId}/presence`);
    
    if (presenceListenerUnsubscribe) {
        presenceListenerUnsubscribe();
    }
    
    presenceListenerUnsubscribe = onChildRemoved(presencePathRef, (snapshot) => {
        const playerId = snapshot.key;
        const playerData = snapshot.val();
        if (playerId && playerData?.name) {
            onLeave(playerId, playerData.name);
        }
    });
};


/**
 * Closes the connection and detaches all Firebase listeners.
 */
export const closeChannel = (): void => {
    if (stateListenerUnsubscribe) {
        stateListenerUnsubscribe();
        stateListenerUnsubscribe = null;
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