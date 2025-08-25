import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameData, Player, Character, DialogueLogEntry, ChoiceLogEntry, StoryLogEntry, Asset, AssetType, Quest, GameMode, ChatMessage, Choice } from '../types';
import { Action } from '../state/reducer';
import { NARRATOR_CHARACTER } from '../constants';
import ChatView from './ChatView';

// --- Types for Scene State ---
interface SceneState {
  backgroundUrl: string | null;
  cgUrl: string | null;
  sprites: { [characterId: string]: string | null }; // Value is assetId
  dialogue: { characterName: string; text: string } | null;
}

// --- Helper Functions ---
const findAssetUrlById = (assets: Asset[], assetId: string | null): string | null => {
    if (!assetId) return null;
    const asset = assets.find(a => a.id === assetId);
    return asset ? asset.url : null;
};

// --- Sub-components ---

const Visuals: React.FC<{ scene: SceneState; characters: Character[]; assets: Asset[]; onClick?: () => void; isPlayingBack?: boolean }> = ({ scene, characters, assets, onClick, isPlayingBack = false }) => {
    const bgUrl = findAssetUrlById(assets, scene.backgroundUrl);
    const cgUrl = findAssetUrlById(assets, scene.cgUrl);

    const activeSprites = Object.entries(scene.sprites)
      .map(([charId, assetId]) => {
        const url = findAssetUrlById(assets, assetId);
        const character = characters.find(c => c.id === charId);
        return url && character ? { url, name: character.name } : null;
      })
      .filter((s): s is { url: string; name: string } => s !== null);

    return (
        <div onClick={onClick} className={`aspect-video bg-black rounded-lg shadow-2xl overflow-hidden relative flex-1 ${isPlayingBack ? 'cursor-pointer' : ''}`}>
             {bgUrl && <img src={bgUrl} alt="background" className="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000" style={{opacity: bgUrl ? 1 : 0}} />}
            
            <div className="absolute bottom-0 left-0 right-0 h-full flex justify-center items-end">
                {activeSprites.map((sprite, index) => (
                    <img key={index} src={sprite.url} alt={sprite.name} className="h-full max-h-[80%] object-contain transition-transform duration-500" />
                ))}
            </div>

            {cgUrl && (
                 <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
                    <img src={cgUrl} alt="cg" className="max-w-full max-h-full object-contain rounded-lg" />
                </div>
            )}
        </div>
    );
};

const DialogueBox: React.FC<{ dialogue: { characterName: string; text: string } | null }> = ({ dialogue }) => {
    if (!dialogue) return <div className="h-32"></div>;
    return (
        <div className="bg-secondary bg-opacity-90 p-4 rounded-lg border border-accent min-h-[8rem]">
            <h3 className="text-xl font-bold text-highlight mb-2">{dialogue.characterName}</h3>
            <p className="text-light whitespace-pre-wrap">{dialogue.text}</p>
        </div>
    );
};


const HistoryView: React.FC<{ log: StoryLogEntry[], characters: Character[], assets: Asset[] }> = ({ log, characters, assets }) => {
    const logEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);
    
    const getCharacterName = (id: string) => characters.find(c => c.id === id)?.name || 'Unknown';
    const getAssetName = (id: string | null) => assets.find(a => a.id === id)?.name || 'None';

    return (
        <div className="space-y-2 p-2 overflow-y-auto h-full bg-primary rounded-md text-sm">
            {log.map((entry, index) => {
                switch (entry.type) {
                    case 'dialogue':
                        return <div key={index}><strong>{getCharacterName(entry.characterId)}:</strong> {entry.text}</div>;
                    case 'choice_selection':
                        return <div key={index} className="text-blue-400 italic">Choice made by {getCharacterName(entry.characterId)}: "{entry.choice.text}"</div>
                    case 'background_change':
                        return <div key={index} className="text-gray-400 italic">Background changed to: {getAssetName(entry.assetId)}</div>
                    case 'sprite_change':
                        return <div key={index} className="text-gray-400 italic">{getCharacterName(entry.characterId)}'s sprite changed to: {getAssetName(entry.assetId)}</div>
                    case 'cg_show':
                        return <div key={index} className="text-gray-400 italic">CG shown: {getAssetName(entry.assetId)}</div>
                    case 'dice_roll':
                        return <div key={index} className="text-purple-400 italic">{getCharacterName(entry.characterId)} rolled a {entry.result} (d{entry.sides})</div>
                    case 'quest_status':
                    case 'stat_change':
                        return <div key={index} className="text-yellow-400 italic">{entry.text}</div>
                    default:
                        return null;
                }
            })}
            <div ref={logEndRef} />
        </div>
    );
};

const StatusView: React.FC<{ characters: Character[], quests: Quest[], coins: number }> = ({ characters, quests, coins }) => {
    return (
        <div className="p-2 overflow-y-auto h-full bg-primary rounded-md space-y-4">
            <div>
                <h4 className="text-lg font-bold text-highlight mb-2">Party Coins: {coins}</h4>
            </div>
            <div>
                <h4 className="text-lg font-bold text-highlight mb-2">Characters</h4>
                {characters.filter(c => c.id !== 'narrator').map(char => (
                    <div key={char.id} className="bg-accent p-2 rounded mb-2">
                        <p className="font-bold">{char.name}</p>
                        <p className="text-sm">HP: {char.health}/{char.maxHealth} | MP: {char.mana}/{char.maxMana}</p>
                    </div>
                ))}
            </div>
             <div>
                <h4 className="text-lg font-bold text-highlight mb-2">Active Quests</h4>
                {quests.filter(q => q.status === 'active').map(quest => (
                    <div key={quest.id} className="bg-accent p-2 rounded mb-2">
                        <p className="font-bold">{quest.title}</p>
                        <p className="text-sm text-gray-300">{quest.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PlayerControls: React.FC<{
    gameData: GameData;
    dispatch: React.Dispatch<Action>;
    currentPlayer: Player;
    onEndTurn: () => void;
}> = ({ gameData, dispatch, currentPlayer, onEndTurn }) => {
    const [speakerId, setSpeakerId] = useState<string>(NARRATOR_CHARACTER.id);
    const [dialogue, setDialogue] = useState('');
    const [choices, setChoices] = useState<Choice[]>([{text: ''}, {text: ''}]);
    
    const addLog = (entry: StoryLogEntry) => dispatch({ type: 'ADD_LOG_ENTRY', payload: entry });

    const handleSpeak = () => {
        if (!dialogue.trim()) return;
        addLog({ type: 'dialogue', characterId: speakerId, text: dialogue });
        setDialogue('');
    };

    const handleEndTurnWithChoices = () => {
        const validChoices = choices.filter(c => c.text.trim());
        if (validChoices.length > 0) {
            addLog({ type: 'choice', choices: validChoices });
        }
        onEndTurn();
    };

    const updateChoiceText = (index: number, text: string) => {
        const newChoices = [...choices];
        newChoices[index].text = text;
        setChoices(newChoices);
    }
    
    const handleChangeBg = () => {
        const assetName = prompt("Enter name of background asset to use (or blank to clear):");
        if (assetName === null) return;
        const asset = gameData.assets.find(a => a.type === 'background' && a.name.toLowerCase() === assetName.toLowerCase());
        addLog({type: 'background_change', assetId: asset ? asset.id : null});
    }
    const handleShowCg = () => {
        const assetName = prompt("Enter name of CG asset to show (or blank to clear):");
        if (assetName === null) return;
        const asset = gameData.assets.find(a => a.type === 'cg' && a.name.toLowerCase() === assetName.toLowerCase());
        addLog({type: 'cg_show', assetId: asset ? asset.id : null});
    }
    const handleChangeSprite = () => {
        const charName = prompt("Enter character name to change sprite for:");
        if (!charName) return;
        const character = gameData.characters.find(c => c.name.toLowerCase() === charName.toLowerCase());
        if (!character) { alert('Character not found'); return; }
        
        const assetName = prompt(`Enter name of sprite for ${character.name} (or blank to clear):`);
        if (assetName === null) return;
        const asset = gameData.assets.find(a => a.type === 'characterSprite' && a.name.toLowerCase() === assetName.toLowerCase());
        addLog({type: 'sprite_change', characterId: character.id, assetId: asset ? asset.id : null});
    }
    const handleRollDice = () => {
        const sides = parseInt(prompt("How many sides on the die?", "20") || "20");
        if (isNaN(sides) || sides < 1) return;
        const result = Math.floor(Math.random() * sides) + 1;
        addLog({type: 'dice_roll', characterId: speakerId, sides, result});
    }

    return (
        <div className="bg-secondary p-4 rounded-lg border border-accent space-y-3">
            <h3 className="text-xl font-bold text-highlight">Your Turn, {currentPlayer.name}</h3>
            <div>
                <textarea 
                    value={dialogue} 
                    onChange={e => setDialogue(e.target.value)}
                    placeholder="Enter dialogue as..."
                    className="w-full p-2 bg-primary rounded-md h-20"
                />
                <div className="flex justify-between items-center mt-1">
                    <select value={speakerId} onChange={e => setSpeakerId(e.target.value)} className="p-2 bg-primary rounded-md text-sm">
                        {gameData.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={handleSpeak} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-sm">Add Dialogue</button>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
                 <button onClick={handleChangeBg} className="text-sm px-2 py-2 bg-accent hover:bg-opacity-75 rounded-md">Change BG</button>
                 <button onClick={handleShowCg} className="text-sm px-2 py-2 bg-accent hover:bg-opacity-75 rounded-md">Show CG</button>
                 <button onClick={handleChangeSprite} className="text-sm px-2 py-2 bg-accent hover:bg-opacity-75 rounded-md">Change Sprite</button>
                 <button onClick={handleRollDice} className="text-sm px-2 py-2 bg-accent hover:bg-opacity-75 rounded-md">Roll Dice</button>
            </div>
            
            <div>
                <h4 className="text-md font-semibold text-highlight mb-1">Add Choices for Next Player</h4>
                <div className="space-y-1">
                    {choices.map((choice, index) => (
                        <input key={index} type="text" value={choice.text} onChange={e => updateChoiceText(index, e.target.value)} placeholder={`Choice ${index + 1}`} className="w-full p-1 bg-primary text-sm rounded-md" />
                    ))}
                </div>
            </div>

            <button onClick={handleEndTurnWithChoices} className="w-full mt-2 p-3 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80">
                End Turn
            </button>
        </div>
    );
};


const ChoiceView: React.FC<{
    choices: Choice[];
    currentPlayer: Player;
    dispatch: React.Dispatch<Action>;
    onEndTurn: () => void;
}> = ({ choices, currentPlayer, dispatch, onEndTurn }) => {
    
    const handleSelectChoice = (choice: Choice) => {
        const characterId = NARRATOR_CHARACTER.id; 
        dispatch({
            type: 'ADD_LOG_ENTRY',
            payload: {
                type: 'choice_selection',
                playerId: currentPlayer.id,
                characterId,
                choice,
            }
        });
        onEndTurn();
    };

    return (
         <div className="bg-secondary p-4 rounded-lg border border-accent space-y-2">
            <h3 className="text-xl font-bold text-highlight">Your Choice, {currentPlayer.name}</h3>
            {choices.map((choice, index) => (
                <button 
                    key={index}
                    onClick={() => handleSelectChoice(choice)}
                    className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-left"
                >
                    {choice.text}
                </button>
            ))}
        </div>
    )
}

// --- Main Component ---
interface GameViewProps {
  gameData: GameData;
  dispatch: React.Dispatch<Action>;
  currentPlayer: Player | undefined;
  onEndTurn: () => void;
  gameMode: GameMode;
  myPlayerId: string | null;
}

export const GameView: React.FC<GameViewProps> = ({
  gameData,
  dispatch,
  currentPlayer,
  onEndTurn,
  gameMode,
  myPlayerId,
}) => {
    const [scene, setScene] = useState<SceneState>({ backgroundUrl: null, cgUrl: null, sprites: {}, dialogue: null });
    const [activeTab, setActiveTab] = useState<'history' | 'status'>('history');

    useEffect(() => {
        let currentScene: SceneState = { backgroundUrl: null, cgUrl: null, sprites: {}, dialogue: null };
        gameData.storyLog.forEach(log => {
            switch (log.type) {
                case 'background_change': 
                    currentScene.backgroundUrl = log.assetId;
                    break;
                case 'sprite_change': 
                    currentScene.sprites[log.characterId] = log.assetId;
                    break;
                case 'cg_show': 
                    currentScene.cgUrl = log.assetId;
                    break;
                case 'dialogue':
                    const char = gameData.characters.find(c => c.id === log.characterId);
                    currentScene.dialogue = { characterName: char?.name || 'Narrator', text: log.text };
                    break;
                case 'choice_selection':
                    const choiceChar = gameData.characters.find(c => c.id === log.characterId);
                    currentScene.dialogue = { characterName: 'Narrator', text: `${choiceChar?.name || 'A player'} chose: "${log.choice.text}"` };
                    break;
                case 'stat_change':
                case 'quest_status':
                    currentScene.dialogue = { characterName: 'System', text: log.text };
                    break;
            }
        });
        setScene(currentScene);
    }, [gameData.storyLog, gameData.characters]);

    const lastLogEntry = gameData.storyLog[gameData.storyLog.length - 1];
    const isMyTurn = currentPlayer?.id === myPlayerId || (gameMode === 'local' && gameData.players.length > 0);
    const isGmSpectator = gameMode === 'online-gm' && !myPlayerId;
    
    const canControl = isMyTurn || (isGmSpectator && !lastLogEntry); // GM can start if log is empty
    const isWaitingForChoice = lastLogEntry?.type === 'choice';

    const canPlayerSendMessage = (gameMode === 'local') || (gameMode === 'online-player') || (gameMode === 'online-gm' && !!myPlayerId);

    const handleSendMessage = (text: string) => {
        const sender = gameData.players.find(p => p.id === myPlayerId) || (gameMode === 'online-gm' && !myPlayerId ? {id: 'gm', name: 'Game Master'} : null);
        if (!sender) return;
        
        const message: ChatMessage = { senderId: sender.id, senderName: sender.name, text, timestamp: Date.now() };
        dispatch({type: 'ADD_CHAT_MESSAGE', payload: message});
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
                <Visuals scene={scene} characters={gameData.characters} assets={gameData.assets} />
                <DialogueBox dialogue={scene.dialogue} />
            </div>
            <div className="bg-secondary p-2 rounded-lg flex flex-col gap-2 min-h-[50vh]">
                <div className="flex border-b border-accent">
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-2 ${activeTab === 'history' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>History</button>
                    <button onClick={() => setActiveTab('status')} className={`px-4 py-2 ${activeTab === 'status' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Status</button>
                </div>
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'history' ? (
                        <HistoryView log={gameData.storyLog} characters={gameData.characters} assets={gameData.assets} />
                    ) : (
                        <StatusView characters={gameData.characters} quests={gameData.quests} coins={gameData.coins} />
                    )}
                </div>
                {currentPlayer && canControl ? (
                    isWaitingForChoice ? (
                        <ChoiceView choices={lastLogEntry.choices} currentPlayer={currentPlayer} dispatch={dispatch} onEndTurn={onEndTurn} />
                    ) : (
                        <PlayerControls gameData={gameData} dispatch={dispatch} currentPlayer={currentPlayer} onEndTurn={onEndTurn} />
                    )
                ) : null}
                 {!currentPlayer && !isGmSpectator && (
                     <div className="text-center p-4">
                        <p>Waiting for players...</p>
                     </div>
                 )}
            </div>
            <ChatView 
                chatLog={gameData.chatLog}
                onSendMessage={handleSendMessage}
                canSendMessage={canPlayerSendMessage}
            />
        </div>
    );
};
