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
  inventory: [],
};

export const INITIAL_GAME_DATA: GameData = {
  storyPrompt: 'A group of adventurers finds a mysterious, glowing artifact in an ancient ruin...',
  assets: [],
  characters: [NARRATOR_CHARACTER],
  storyLog: [],
  quests: [],
  coins: 0,
};

export const MAX_PLAYERS = 5;
