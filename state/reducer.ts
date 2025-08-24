import { GameData, StoryLogEntry, Asset, Character, Quest, Item } from '../types';
import { INITIAL_GAME_DATA } from '../constants';

export type Action =
  | { type: 'UPDATE_STORY_PROMPT'; payload: string }
  | { type: 'ADD_ASSET'; payload: Omit<Asset, 'id'> }
  | { type: 'DELETE_ASSET', payload: { id: string } }
  | { type: 'SET_ASSET_PUBLISHED', payload: { id: string, isPublished: boolean } }
  | { type: 'ADD_CHARACTER'; payload: Omit<Character, 'id' | 'health' | 'maxHealth' | 'mana' | 'maxMana' | 'inventory'> }
  | { type: 'UPDATE_CHARACTER'; payload: Character }
  | { type: 'DELETE_CHARACTER'; payload: { id: string } }
  | { type: 'ADD_LOG_ENTRY'; payload: StoryLogEntry }
  | { type: 'RESET_STORY_LOG' }
  | { type: 'BATCH_ADD_DATA'; payload: { characters: Character[], assets: Asset[] } }
  | { type: 'ADD_QUEST'; payload: Omit<Quest, 'id' | 'status'> }
  | { type: 'UPDATE_QUEST'; payload: Pick<Quest, 'id' | 'status'> }
  | { type: 'SET_COINS'; payload: number }
  | { type: 'ADD_ITEM_TO_CHARACTER'; payload: { characterId: string; item: Omit<Item, 'id'> } }
  | { type: 'REMOVE_ITEM_FROM_CHARACTER'; payload: { characterId: string; itemId: string } }
  | { type: 'SET_GAME_DATA'; payload: GameData };


export const gameReducer = (state: GameData, action: Action): GameData => {
  switch (action.type) {
    case 'UPDATE_STORY_PROMPT':
      return {
        ...state,
        storyPrompt: action.payload,
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
                mana: 50,
                maxMana: 50,
                inventory: [],
                ...action.payload 
            }],
        };
    case 'UPDATE_CHARACTER':
        return {
            ...state,
            characters: state.characters.map(c => c.id === action.payload.id ? action.payload : c)
        }
    case 'DELETE_CHARACTER':
        return {
            ...state,
            characters: state.characters.filter(c => c.id !== action.payload.id)
        }
    case 'ADD_LOG_ENTRY':
      return {
        ...state,
        storyLog: [...state.storyLog, action.payload],
      };
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
    case 'ADD_QUEST':
      return {
        ...state,
        quests: [...state.quests, { id: `quest-${Date.now()}`, status: 'active', ...action.payload }],
      };
    case 'UPDATE_QUEST': {
        const questToUpdate = state.quests.find(q => q.id === action.payload.id);
        if (!questToUpdate || questToUpdate.status === action.payload.status) {
            return state; // No change if quest not found or status is the same
        }

        const updatedQuests = state.quests.map(q => q.id === action.payload.id ? { ...q, status: action.payload.status } : q);
        let updatedCharacters = state.characters;
        let updatedCoins = state.coins;
        const logEntries: StoryLogEntry[] = [];

        // If quest is completed, distribute rewards
        if (action.payload.status === 'completed') {
            const { rewards, assignedCharacterId, title } = questToUpdate;
            updatedCoins += rewards.coins;
            logEntries.push({type: 'quest_status', text: `Quest Completed: ${title}`});
            if (rewards.coins > 0) {
                 logEntries.push({type: 'stat_change', text: `Party received ${rewards.coins} coins.`});
            }
            
            if (assignedCharacterId) {
                updatedCharacters = state.characters.map(c => {
                    if (c.id === assignedCharacterId) {
                        const newItems = (rewards.items || []).map(item => ({ ...item, id: `item-${Date.now()}-${Math.random()}` }));
                        if (newItems.length > 0) {
                            logEntries.push({type: 'stat_change', text: `${c.name} received ${newItems.map(i => `[${i.name}]`).join(', ')}.`});
                        }
                        return { ...c, inventory: [...(c.inventory || []), ...newItems] };
                    }
                    return c;
                });
            }
        }
        
        return {
            ...state,
            quests: updatedQuests,
            characters: updatedCharacters,
            coins: updatedCoins,
            storyLog: [...state.storyLog, ...logEntries]
        };
    }
    case 'SET_COINS':
        return {
            ...state,
            coins: action.payload >= 0 ? action.payload : 0,
        };
    case 'ADD_ITEM_TO_CHARACTER': {
        const newItem: Item = { id: `item-${Date.now()}`, ...action.payload.item };
        return {
            ...state,
            characters: state.characters.map(c => 
                c.id === action.payload.characterId 
                ? { ...c, inventory: [...(c.inventory || []), newItem] } 
                : c
            )
        };
    }
    case 'REMOVE_ITEM_FROM_CHARACTER':
        return {
            ...state,
            characters: state.characters.map(c => 
                c.id === action.payload.characterId 
                ? { ...c, inventory: (c.inventory || []).filter(item => item.id !== action.payload.itemId) } 
                : c
            )
        };
    case 'SET_GAME_DATA': {
        const payload = action.payload;
        // When receiving data from Firebase, empty arrays might be omitted.
        // This ensures the state always has a valid array for each property.
        return {
            ...INITIAL_GAME_DATA,
            ...payload,
            assets: payload.assets || [],
            characters: payload.characters || [],
            storyLog: payload.storyLog || [],
            quests: payload.quests || [],
        };
    }
    default:
      return state;
  }
};