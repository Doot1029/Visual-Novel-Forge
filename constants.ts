import { GameData, Character } from './types';

export const NARRATOR_CHARACTER: Character = {
  id: 'narrator',
  name: 'Narrator',
  bio: 'The impartial storyteller who describes scenes and actions.',
  spriteAssetIds: [],
  health: 999,
  maxHealth: 999,
  mana: 999,
  maxMana: 999,
};

export const INITIAL_GAME_DATA: GameData = {
  gmRules: '1. Be respectful to other players.\n2. No NSFW content.\n3. The Game Master\'s decisions are final.\n4. Have fun!',
  assets: [],
  characters: [NARRATOR_CHARACTER],
  storyLog: [],
  quests: [],
  coins: 0,
  chatLog: [],
  lobbyChatLog: [],
  lobbyMusicUrl: null,
};

export const MAX_PLAYERS = 5;