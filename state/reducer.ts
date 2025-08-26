import { GameData, StoryLogEntry, Asset, Character, Quest, ChatMessage, Player, Choice } from '../types';
import { MAX_PLAYERS } from '../constants';

export type Action =
  | { type: 'UPDATE_TITLE', payload: string }
  | { type: 'UPDATE_GM_RULES'; payload: string }
  | { type: 'ADD_ASSET'; payload: Omit<Asset, 'id'> }
  | { type: 'DELETE_ASSET', payload: { id: string } }
  | { type: 'SET_ASSET_PUBLISHED', payload: { id: string, isPublished: boolean } }
  | { type: 'ADD_CHARACTER'; payload: Omit<Character, 'id' | 'health' | 'maxHealth' | 'status' | 'stats'> }
  | { type: 'UPDATE_CHARACTER'; payload: Character }
  | { type: 'DELETE_CHARACTER'; payload: { id: string } }
  | { type: 'ADD_LOG_ENTRY'; payload: StoryLogEntry }
  | { type: 'RESET_STORY_LOG' }
  | { type: 'BATCH_ADD_DATA'; payload: { characters: Character[], assets: Asset[] } }
  | { type: 'BATCH_ADD_ASSETS'; payload: Omit<Asset, 'id'>[] }
  | { type: 'ADD_QUEST'; payload: Omit<Quest, 'id' | 'status'> }
  | { type: 'UPDATE_QUEST'; payload: Pick<Quest, 'id' | 'status'> }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'ADD_LOBBY_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LOBBY_MUSIC'; payload: string | null }
  | { type: 'SET_GAME_DATA'; payload: GameData }
  | { type: 'ADD_PLAYER'; payload: Player }
  | { type: 'UPDATE_PLAYER'; payload: Player }
  | { type: 'REMOVE_PLAYER'; payload: { id: string } }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'SUBMIT_ASSET_FOR_APPROVAL', payload: { asset: Omit<Asset, 'id' | 'isPublished'>, characterIdToAssign: string, submittingPlayerId: string } }
  | { type: 'APPROVE_ASSET', payload: GameData['pendingAssetApprovals'][0] }
  | { type: 'REJECT_ASSET', payload: GameData['pendingAssetApprovals'][0] };


export const gameReducer = (state: GameData, action: Action): GameData => {
  switch (action.type) {
    case 'UPDATE_TITLE':
      return {
        ...state,
        title: action.payload,
      };
    case 'UPDATE_GM_RULES':
      return {
        ...state,
        gmRules: action.payload,
      };
    case 'ADD_ASSET':
      return {
        ...state,
        assets: [...state.assets, { id: `asset-${Date.now()}`, isPublished: false, ...action.payload }],
      };
    case 'DELETE_ASSET': {
        const assetIdToDelete = action.payload.id;
        return {
            ...state,
            assets: state.assets.filter(a => a.id !== assetIdToDelete),
            characters: state.characters.map(c => ({
                ...c,
                spriteAssetIds: (c.spriteAssetIds || []).filter(id => id !== assetIdToDelete)
            }))
        };
    }
    case 'SET_ASSET_PUBLISHED':
        return {
            ...state,
            assets: state.assets.map(asset => 
                asset.id === action.payload.id 
                ? { ...asset, isPublished: action.payload.isPublished } 
                : asset
            )
        };
    case 'ADD_CHARACTER':
        return {
            ...state,
            characters: [...state.characters, { 
                id: `char-${Date.now()}`,
                health: 100,
                maxHealth: 100,
                status: 'active',
                stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                ...action.payload 
            }],
        };
    case 'UPDATE_CHARACTER': {
        const originalChar = state.characters.find(c => c.id === action.payload.id);
        const updatedChar = action.payload;
        const newLogEntries: StoryLogEntry[] = [];

        if (originalChar && originalChar.health > 0 && updatedChar.health <= 0) {
            updatedChar.status = 'defeated';
            newLogEntries.push({ type: 'stat_change', text: `${updatedChar.name} has been defeated!` });
            newLogEntries.push({ type: 'sprite_change', characterId: updatedChar.id, assetId: null });
        } else if (originalChar && originalChar.status === 'defeated' && updatedChar.status === 'active') {
            newLogEntries.push({ type: 'stat_change', text: `${updatedChar.name} has returned to the fight!` });
        }
        
        return {
            ...state,
            characters: state.characters.map(c => c.id === updatedChar.id ? updatedChar : c),
            storyLog: [...state.storyLog, ...newLogEntries]
        };
    }
    case 'DELETE_CHARACTER':
        return {
            ...state,
            characters: state.characters.filter(c => c.id !== action.payload.id)
        }
    case 'ADD_LOG_ENTRY': {
        if (action.payload.type !== 'choice_selection' || !action.payload.choice.effects) {
             return {
                ...state,
                storyLog: [...state.storyLog, action.payload],
             };
        }

        const { choice, playerId } = action.payload;
        const { effects } = choice;
        
        let newPlayers = [...state.players];
        let newCharacters = [...state.characters];
        const newLogEntries: StoryLogEntry[] = [action.payload];
        
        const playerIndex = newPlayers.findIndex(p => p.id === playerId);
        if (playerIndex !== -1 && effects.coins) {
            const player = { ...newPlayers[playerIndex] };
            player.coins = (player.coins || 0) + effects.coins;
            newPlayers[playerIndex] = player;
            newLogEntries.push({
                type: 'stat_change',
                text: `${player.name} ${effects.coins > 0 ? 'gained' : 'lost'} ${Math.abs(effects.coins)} coins.`
            });
        }
        
        const targetCharIndex = newCharacters.findIndex(c => c.id === effects.targetCharacterId);
        if (targetCharIndex !== -1) {
            const targetChar = { ...newCharacters[targetCharIndex] };
            let updated = false;

            if (effects.hp) {
                const oldHp = targetChar.health;
                const oldStatus = targetChar.status;
                targetChar.health = Math.max(0, oldHp + effects.hp);
                 newLogEntries.push({
                    type: 'stat_change',
                    text: `${targetChar.name} ${effects.hp > 0 ? 'gained' : 'lost'} ${Math.abs(effects.hp)} HP. (${targetChar.health}/${targetChar.maxHealth})`
                });
                updated = true;

                if (targetChar.health <= 0 && oldStatus === 'active') {
                    targetChar.status = 'defeated';
                    newLogEntries.push({ type: 'stat_change', text: `${targetChar.name} has been defeated!`});
                    newLogEntries.push({ type: 'sprite_change', characterId: targetChar.id, assetId: null });
                }
            }

            if(updated) {
                 newCharacters[targetCharIndex] = targetChar;
            }
        }
        
        return {
            ...state,
            players: newPlayers,
            characters: newCharacters,
            storyLog: [...state.storyLog, ...newLogEntries]
        };
    }
    case 'RESET_STORY_LOG':
        return {
            ...state,
            storyLog: []
        }
    case 'BATCH_ADD_DATA':
        return {
            ...state,
            characters: [...state.characters, ...action.payload.characters],
            assets: [...state.assets, ...action.payload.assets],
        };
    case 'BATCH_ADD_ASSETS': {
        const newAssets = action.payload.map((asset, index) => ({
            id: `asset-${Date.now()}-${index}`,
            ...asset,
        }));
        return {
            ...state,
            assets: [...state.assets, ...newAssets],
        };
    }
    case 'ADD_QUEST':
      return {
        ...state,
        quests: [...state.quests, { id: `quest-${Date.now()}`, status: 'active', ...action.payload }],
      };
    case 'UPDATE_QUEST': {
        const questToUpdate = state.quests.find(q => q.id === action.payload.id);
        if (!questToUpdate || questToUpdate.status === action.payload.status) {
            return state;
        }

        const updatedQuests = state.quests.map(q => q.id === action.payload.id ? { ...q, status: action.payload.status } : q);
        const logEntries: StoryLogEntry[] = [];

        if (action.payload.status === 'completed') {
            const { rewards, title } = questToUpdate;
            logEntries.push({type: 'quest_status', text: `Quest Completed: ${title}`});
            if (rewards.coins > 0) {
                 logEntries.push({type: 'stat_change', text: `Party received a reward of ${rewards.coins} coins. The GM will distribute them.`});
            }
        }
        
        return {
            ...state,
            quests: updatedQuests,
            storyLog: [...state.storyLog, ...logEntries]
        };
    }
    case 'ADD_CHAT_MESSAGE':
        return {
            ...state,
            chatLog: [...(state.chatLog || []), action.payload],
        };
    case 'ADD_LOBBY_CHAT_MESSAGE':
        return {
            ...state,
            lobbyChatLog: [...(state.lobbyChatLog || []), action.payload],
        };
    case 'SET_LOBBY_MUSIC':
        return {
            ...state,
            lobbyMusicUrl: action.payload,
        };
    case 'ADD_PLAYER': {
        if (state.players.length >= MAX_PLAYERS || state.players.find(p => p.id === action.payload.id)) return state;
        const newPlayer = { ...action.payload, coins: action.payload.coins || 0 };
        return { ...state, players: [...state.players, newPlayer] };
    }
    case 'UPDATE_PLAYER': {
        return { ...state, players: state.players.map(p => p.id === action.payload.id ? action.payload : p) };
    }
    case 'REMOVE_PLAYER': {
        return { ...state, players: state.players.filter(p => p.id !== action.payload.id) };
    }
    case 'SET_PLAYERS': {
        // Ensure all players have a coins property
        const playersWithCoins = action.payload.map(p => ({ ...p, coins: p.coins || 0 }));
        return { ...state, players: playersWithCoins };
    }
    case 'SUBMIT_ASSET_FOR_APPROVAL': {
        const { asset, characterIdToAssign, submittingPlayerId } = action.payload;
        const newAsset = { id: `asset-${Date.now()}`, isPublished: false, ...asset };
        const newApproval = { assetId: newAsset.id, characterIdToAssign, submittingPlayerId };
        return {
            ...state,
            assets: [...state.assets, newAsset],
            pendingAssetApprovals: [...state.pendingAssetApprovals, newApproval],
            players: state.players.map(p => p.id === submittingPlayerId ? {...p, isWaitingForApproval: true} : p)
        }
    }
    case 'APPROVE_ASSET': {
        const { assetId, characterIdToAssign, submittingPlayerId } = action.payload;
        
        const characterIndex = state.characters.findIndex(c => c.id === characterIdToAssign);
        if (characterIndex === -1) return state;

        const newCharacter = { ...state.characters[characterIndex] };
        newCharacter.spriteAssetIds = [...(newCharacter.spriteAssetIds || []), assetId];
        const newCharacters = [...state.characters];
        newCharacters[characterIndex] = newCharacter;

        return {
            ...state,
            assets: state.assets.map(a => a.id === assetId ? {...a, isPublished: true} : a),
            characters: newCharacters,
            pendingAssetApprovals: state.pendingAssetApprovals.filter(p => p.assetId !== assetId),
            players: state.players.map(p => p.id === submittingPlayerId ? {...p, isWaitingForApproval: false} : p)
        }
    }
    case 'REJECT_ASSET': {
        const { assetId, submittingPlayerId } = action.payload;
        return {
            ...state,
            assets: state.assets.filter(a => a.id !== assetId),
            pendingAssetApprovals: state.pendingAssetApprovals.filter(p => p.assetId !== assetId),
            players: state.players.map(p => p.id === submittingPlayerId ? {...p, isWaitingForApproval: false} : p)
        }
    }
    case 'SET_GAME_DATA': {
        const payload = action.payload;
        return {
            title: payload.title || 'Untitled Adventure',
            gmRules: payload.gmRules,
            assets: payload.assets || [],
            characters: payload.characters || [],
            storyLog: payload.storyLog || [],
            quests: payload.quests || [],
            chatLog: payload.chatLog || [],
            lobbyChatLog: payload.lobbyChatLog || [],
            lobbyMusicUrl: payload.lobbyMusicUrl || null,
            players: payload.players || [],
            pendingAssetApprovals: payload.pendingAssetApprovals || [],
        };
    }
    default:
      return state;
  }
};
