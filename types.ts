export type GamePhase = 'setup' | 'play';

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  lastSeenLogIndex: number;
}

export type AssetType = 'background' | 'characterSprite' | 'cg';

export interface Asset {
  id: string;
  type: AssetType;
  url: string; // data URL or path
  name: string;
  isPublished?: boolean;
}

export type ItemType = 'key' | 'disposable';

export interface Item {
  id: string;
  name:string;
  description: string;
  type: ItemType;
}

export type QuestStatus = 'active' | 'completed';

export interface Quest {
  id:string;
  title: string;
  description: string;
  assignedCharacterId: string | null;
  status: QuestStatus;
  rewards: {
    coins: number;
    items: Omit<Item, 'id'>[];
  }
}

export interface Character {
  id: string;
  name: string;
  bio: string;
  spriteAssetIds: string[];
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  inventory: Item[];
}

export interface DialogueLogEntry {
  type: 'dialogue';
  characterId: string;
  text: string;
}

export interface ChoiceLogEntry {
  type: 'choice';
  choices: { text: string }[];
}

export interface ChoiceSelectionLogEntry {
  type: 'choice_selection';
  playerId: PlayerId;
  characterId: string;
  text: string;
}

export interface BackgroundChangeLogEntry {
  type: 'background_change';
  assetId: string | null;
}

export interface SpriteChangeLogEntry {
  type: 'sprite_change';
  characterId: string;
  assetId: string | null;
}

export interface CgShowLogEntry {
  type: 'cg_show';
  assetId: string | null;
}

export interface DiceRollLogEntry {
  type: 'dice_roll';
  characterId: string;
  sides: number;
  result: number;
}

export interface QuestStatusLogEntry {
  type: 'quest_status';
  text: string;
}

export interface StatChangeLogEntry {
    type: 'stat_change';
    text: string;
}

export type StoryLogEntry =
  | DialogueLogEntry
  | ChoiceLogEntry
  | ChoiceSelectionLogEntry
  | BackgroundChangeLogEntry
  | SpriteChangeLogEntry
  | CgShowLogEntry
  | DiceRollLogEntry
  | QuestStatusLogEntry
  | StatChangeLogEntry;


export interface GameData {
  storyPrompt: string;
  assets: Asset[];
  characters: Character[];
  storyLog: StoryLogEntry[];
  quests: Quest[];
  coins: number;
}

export type GameMode = 'local' | 'online-gm' | 'online-player';
