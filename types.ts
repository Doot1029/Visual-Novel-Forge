export type GamePhase = 'setup' | 'play';

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  lastSeenLogIndex: number;
  isWaitingForApproval?: boolean;
  coins: number;
}

export type AssetType = 'background' | 'characterSprite' | 'cg';

export interface Asset {
  id: string;
  type: AssetType;
  url: string; // data URL or path
  name: string;
  isPublished?: boolean;
  ownerId?: PlayerId;
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
  }
}

export interface CharacterStats {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
}

export interface Character {
  id: string;
  name: string;
  bio: string;
  spriteAssetIds: string[];
  health: number;
  maxHealth: number;
  status: 'active' | 'defeated';
  stats: CharacterStats;
}

export interface DialogueLogEntry {
  type: 'dialogue';
  characterId: string;
  text: string;
}

export interface Choice {
  text: string;
  effects?: {
    coins?: number;
    hp?: number;
    targetCharacterId?: string;
  };
}

export interface ChoiceLogEntry {
  type: 'choice';
  choices: Choice[];
}

export interface ChoiceSelectionLogEntry {
  type: 'choice_selection';
  playerId: PlayerId;
  characterId: string;
  choice: Choice;
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

export interface ChatMessage {
    senderId: PlayerId;
    senderName: string;
    text: string;
    timestamp: number;
}

export interface GameData {
  title: string;
  gmRules: string;
  assets: Asset[];
  characters: Character[];
  storyLog: StoryLogEntry[];
  quests: Quest[];
  chatLog: ChatMessage[];
  lobbyChatLog: ChatMessage[];
  lobbyMusicUrl: string | null;
  players: Player[];
  pendingAssetApprovals: {
      assetId: string;
      characterIdToAssign: string;
      submittingPlayerId: PlayerId;
  }[];
}

export type GameMode = 'local' | 'online-gm' | 'online-player';

export interface SavedSession {
    gameId: string;
    title: string;
    role: 'gm' | 'player';
    myPlayerId?: string;
    myPlayerName?: string;
    lastAccessed: number;
}