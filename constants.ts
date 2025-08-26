import { GameData, Character } from './types';

export const NARRATOR_CHARACTER: Character = {
  id: 'narrator',
  name: 'Narrator',
  bio: 'The impartial storyteller who describes scenes and actions.',
  spriteAssetIds: [],
  health: 999,
  maxHealth: 999,
  status: 'active',
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
};

export const INITIAL_GAME_DATA: Omit<GameData, 'players'> = {
  title: 'Untitled Adventure',
  gmRules: '1. Be respectful to other players.\n2. No NSFW content.\n3. The Game Master\'s decisions are final.\n4. Have fun!',
  assets: [],
  characters: [NARRATOR_CHARACTER],
  storyLog: [],
  quests: [],
  chatLog: [],
  lobbyChatLog: [],
  lobbyMusicUrl: null,
  pendingAssetApprovals: [],
};

export const MAX_PLAYERS = 5;
