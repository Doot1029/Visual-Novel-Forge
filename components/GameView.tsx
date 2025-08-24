import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameData, Player, Character, DialogueLogEntry, ChoiceLogEntry, StoryLogEntry, Asset, AssetType, Quest, Item, GameMode } from '../types';
import { Action } from '../state/reducer';
import * as gemini from '../services/geminiService';
import { NARRATOR_CHARACTER } from '../constants';

// --- Types for Scene State ---
interface SceneState {
  backgroundUrl: string | null;
  cgUrl: string | null;
  sprites: { [characterId: string]: string | null }; // Value is assetId
  dialogue: { characterName: string; text: string } | null;
}

// --- Sub-components ---

const Visuals: React.FC<{ scene: SceneState; characters: Character[]; assets: Asset[]; onClick: () => void; isPlayingBack: boolean }> = ({ scene, characters, assets, onClick, isPlayingBack }) => {
    const findAssetUrl = (assetId: string | null) => {
        if (!assetId) return null;
        const asset = assets.find(a => a.id === assetId);
        return asset ? asset.url : null;
    }

    const bgUrl = scene.backgroundUrl;
    const cgUrl = scene.cgUrl;

    const activeSprites = Object.entries(scene.sprites)
      .map(([charId, assetId]) => {
        const url = findAssetUrl(assetId);
        const character = characters.find(c => c.id === charId);
        return url && character ? { url, name: character.name } : null;
      })
      .filter((s): s is { url: string; name: string } => s !== null);

    return (
        <div onClick={onClick} className={`aspect-video bg-black rounded-lg shadow-2xl overflow-hidden relative flex-1 transition-all duration-500 ${isPlayingBack ? 'cursor-pointer' : ''}`}>
             {bgUrl && <img src={bgUrl} alt="background" className="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000" style={{opacity: bgUrl ? 1 : 0}} />}
             
             <div className="absolute bottom-0 left-0 w-full h-4/5 flex justify-center items-end">
                {activeSprites.map((sprite, index) => (
                    <img key={index} src={sprite.url} alt={sprite.name} className="h-full object-contain transition-all duration-500 mx-4" />
                ))}
             </div>
             
             {cgUrl && <img src={cgUrl} alt="cg" className="absolute top-0 left-0 w-full h-full object-contain bg-black bg-opacity-75 transition-opacity duration-500" style={{opacity: cgUrl ? 1 : 0}} />}

             {scene.dialogue && (
                <div className="absolute bottom-0 left-0 w-full bg-black bg-opacity-70 p-4 border-t-2 border-accent">
                    <p className="font-bold text-highlight mb-1">{scene.dialogue.characterName}</p>
                    <p className="text-lg text-light leading-snug">{scene.dialogue.text}</p>
                </div>
             )}
             {isPlayingBack && (
                <div className="absolute bottom-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            )}
        </div>
    );
};

const HistoryLogContent: React.FC<{ gameData: GameData }> = ({ gameData }) => {
    const logEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [gameData.storyLog]);

    const getCharacter = (id: string) => gameData.characters.find(c => c.id === id);

    return (
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {gameData.storyLog.map((log, index) => {
                let content;
                switch (log.type) {
                    case 'dialogue':
                        content = <p><span className="font-bold text-blue-400">{getCharacter(log.characterId)?.name || 'Unknown'}:</span> {log.text}</p>;
                        break;
                    case 'choice':
                        content = (
                            <div className="bg-accent p-2 rounded-md my-2">
                                <p className="font-semibold text-purple-400">Choices appeared:</p>
                                <ul className="list-disc pl-5">
                                    {(log.choices || []).map((c, i) => <li key={i}>{c.text}</li>)}
                                </ul>
                            </div>
                        );
                        break;
                    case 'choice_selection':
                        content = (
                            <p className="text-yellow-400 italic">
                                {getCharacter(log.characterId)?.name || 'A player'} chose: "{log.text}"
                            </p>
                        );
                        break;
                    case 'dice_roll':
                        content = <p className="text-gray-400 italic">{getCharacter(log.characterId)?.name} rolled a d{log.sides} and got: <span className="font-bold text-white">{log.result}</span></p>
                        break;
                    case 'quest_status':
                        content = <p className="text-green-400 font-semibold">{log.text}</p>
                        break;
                    case 'stat_change':
                        content = <p className="text-teal-400 italic">{log.text}</p>
                        break;
                    default:
                        content = null;
                }
                return <div key={index}>{content}</div>;
            })}
            <div ref={logEndRef} />
        </div>
    );
};

const StatusContent: React.FC<{gameData: GameData}> = ({ gameData }) => {
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

    return (
        <div className="flex-1 overflow-y-auto pr-2">
            <div className="mb-4">
                <h3 className="font-bold text-purple-400 mb-2">Party Coins: <span className="text-yellow-400">{gameData.coins} 💰</span></h3>
            </div>
            
            <div className="mb-4">
                <h3 className="font-bold text-purple-400 mb-2">Character Stats</h3>
                <div className="space-y-3">
                {gameData.characters.filter(c => c.id !== 'narrator').map(char => (
                    <div key={char.id} className="bg-accent p-2 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                             <p className="font-semibold">{char.name}</p>
                             <button onClick={() => setSelectedCharId(char.id === selectedCharId ? null : char.id)} className="text-xs px-2 py-1 bg-primary rounded">
                                {selectedCharId === char.id ? 'Hide Inv.' : 'Show Inv.'}
                             </button>
                        </div>
                       
                        <div title="Health">
                            <span className="text-xs text-red-400">HP</span>
                            <div className="w-full bg-primary rounded-full h-2.5">
                                <div className="bg-red-600 h-2.5 rounded-full" style={{width: `${(char.health / char.maxHealth) * 100}%`}}></div>
                            </div>
                            <span className="text-xs">{char.health} / {char.maxHealth}</span>
                        </div>
                         <div title="Mana">
                            <span className="text-xs text-blue-400">MP</span>
                            <div className="w-full bg-primary rounded-full h-2.5">
                                <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${(char.mana / char.maxMana) * 100}%`}}></div>
                            </div>
                            <span className="text-xs">{char.mana} / {char.maxMana}</span>
                        </div>
                        {selectedCharId === char.id && (
                             <div className="mt-2 pt-2 border-t border-primary">
                                <h4 className="text-sm font-semibold mb-1">Inventory</h4>
                                {(!char.inventory || char.inventory.length === 0) ? (
                                    <p className="text-xs text-gray-400 italic">Empty</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {char.inventory.map(item => (
                                            <li key={item.id} className="text-xs bg-primary p-1 rounded" title={`${item.type} - ${item.description}`}>{item.name}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                </div>
            </div>

            <div>
                <h3 className="font-bold text-purple-400 mb-2">Quest Log</h3>
                <div className="space-y-2">
                    {gameData.quests.map(quest => (
                        <details key={quest.id} className="bg-accent p-2 rounded-lg text-sm">
                            <summary className="cursor-pointer font-semibold">
                                {quest.title} <span className={`text-xs ${quest.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>({quest.status})</span>
                            </summary>
                            <p className="text-xs text-gray-300 mt-1">{quest.description}</p>
                        </details>
                    ))}
                     {gameData.quests.length === 0 && <p className="text-xs text-gray-400 italic">No active quests.</p>}
                </div>
            </div>
        </div>
    );
}

const InputController: React.FC<{ 
    dispatch: React.Dispatch<Action>, 
    gameData: GameData, 
    onEndTurn: () => void, 
    isMyTurn: boolean, 
    currentPlayer: Player,
    currentPlayerIndex: number,
    onSceneChange: (change: Partial<SceneState>) => void;
    isPlayingBack: boolean;
}> = ({ dispatch, gameData, onEndTurn, isMyTurn, currentPlayer, currentPlayerIndex, onSceneChange, isPlayingBack }) => {
    const [dialogue, setDialogue] = useState('');
    const [choices, setChoices] = useState<{text: string}[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [stagedSceneChanges, setStagedSceneChanges] = useState<StoryLogEntry[]>([]);
    const [speakingCharacterId, setSpeakingCharacterId] = useState<string>(NARRATOR_CHARACTER.id);
    const [diceSides, setDiceSides] = useState(20);

    useEffect(() => {
        // Reset speaking character to Narrator when the player turn changes
        setSpeakingCharacterId(NARRATOR_CHARACTER.id);
    }, [currentPlayer?.id]);

    const speakingCharacter = gameData.characters.find(c => c.id === speakingCharacterId);
    
    const lastLog = gameData.storyLog[gameData.storyLog.length - 1];
    const choicesToShow = lastLog?.type === 'choice' ? lastLog.choices : null;

    const handleAddChoice = () => setChoices([...choices, {text: ''}]);
    const handleRemoveChoice = (index: number) => setChoices(choices.filter((_, i) => i !== index));
    const handleChoiceChange = (index: number, text: string) => {
        const newChoices = [...choices];
        newChoices[index].text = text;
        setChoices(newChoices);
    }
    
    const handleEndTurn = () => {
        const logsToDispatch: StoryLogEntry[] = [...stagedSceneChanges];

        if (dialogue.trim()) {
            logsToDispatch.push({ type: 'dialogue', characterId: speakingCharacterId, text: dialogue.trim() });
        }

        const validChoices = choices.filter(c => c.text.trim());
        if (validChoices.length > 0) {
            logsToDispatch.push({ type: 'choice', choices: validChoices });
        }

        logsToDispatch.forEach(log => dispatch({ type: 'ADD_LOG_ENTRY', payload: log }));
        
        setDialogue('');
        setChoices([]);
        setStagedSceneChanges([]);
        onEndTurn();
    }
    
    const handleChoiceSelection = (choiceText: string) => {
        dispatch({ type: 'ADD_LOG_ENTRY', payload: { type: 'choice_selection', playerId: currentPlayer.id, characterId: speakingCharacterId, text: choiceText } });
        onEndTurn();
    }

    const generateDialogue = async () => {
        if (!speakingCharacter) return;
        setIsGenerating(true);
        try {
            const result = await gemini.generateDialogue(gameData, speakingCharacter);
            setDialogue(result);
        } catch(e) { alert('AI dialogue generation failed.'); } 
        finally { setIsGenerating(false); }
    }
    
    const handleSceneChange = (type: 'background' | 'cg' | 'sprite', assetId: string) => {
        if (!speakingCharacter) return;

        const finalAssetId = assetId || null;
        let newLogEntry: StoryLogEntry | null = null;
        let sceneUpdate: Partial<SceneState> = {};
        const assetUrl = gameData.assets.find(a => a.id === finalAssetId)?.url || null;

        switch(type) {
            case 'background':
                newLogEntry = { type: 'background_change', assetId: finalAssetId };
                sceneUpdate = { backgroundUrl: assetUrl };
                break;
            case 'cg':
                newLogEntry = { type: 'cg_show', assetId: finalAssetId };
                sceneUpdate = { cgUrl: assetUrl };
                break;
            case 'sprite':
                newLogEntry = { type: 'sprite_change', characterId: speakingCharacterId, assetId: finalAssetId };
                sceneUpdate = { sprites: { [speakingCharacterId]: finalAssetId } };
                break;
        }

        if (newLogEntry) {
            onSceneChange(sceneUpdate);

            const finalNewLogEntry = newLogEntry;
            setStagedSceneChanges(prev => {
                const filtered = prev.filter(c => {
                    if (c.type !== finalNewLogEntry.type) return true;
                    if (c.type === 'sprite_change' && finalNewLogEntry.type === 'sprite_change') {
                        return c.characterId !== finalNewLogEntry.characterId;
                    }
                    return false;
                });
                return [...filtered, finalNewLogEntry];
            });
        }
    };
    
    const handleDiceRoll = () => {
        const validSides = Math.max(1, diceSides);
        const result = Math.floor(Math.random() * validSides) + 1;
        dispatch({ type: 'ADD_LOG_ENTRY', payload: {
            type: 'dice_roll',
            characterId: speakingCharacterId,
            sides: validSides,
            result: result,
        }});
    };

    if (!isMyTurn) {
        if (isPlayingBack) {
            return <div className="bg-secondary p-4 rounded-lg mt-4 text-center text-gray-400">Playing back story... (Click visual to advance)</div>;
        }
        return (
            <div className="bg-secondary p-4 rounded-lg mt-4 text-center">
                <p className="text-xl text-gray-400">
                    {`Player ${currentPlayerIndex + 1}'s Turn: `}
                    <span className="text-highlight font-bold">{currentPlayer?.name || '...'}</span>
                </p>
                <p className="font-bold text-2xl animate-pulse text-light mt-2">Please Wait!</p>
            </div>
        );
    }
    
    if (!speakingCharacter) return <div className="bg-secondary p-4 rounded-lg mt-4 text-center text-red-500">Error: Selected character not found.</div>;
    if (!currentPlayer) return <div className="bg-secondary p-4 rounded-lg mt-4 text-center text-red-500">Error: Current player not found.</div>;


    const publishedAssets = gameData.assets.filter(a => a.isPublished);
    const charSprites = publishedAssets.filter(a => (speakingCharacter.spriteAssetIds || []).includes(a.id));

    return (
        <div className="bg-secondary p-4 rounded-lg mt-4">
             <p className="font-bold text-xl mb-2">Your Turn! (<span className="text-highlight">{currentPlayer.name}</span>)</p>
             {choicesToShow ? (
                <div>
                    <p className="text-lg mb-2">You must make a choice:</p>
                    <div className="mb-4">
                        <label htmlFor="choose-as-select" className="block text-sm font-semibold text-gray-400 mb-1">Choose as</label>
                        <select
                            id="choose-as-select"
                            value={speakingCharacterId}
                            onChange={(e) => setSpeakingCharacterId(e.target.value)}
                            className="w-full p-2 bg-accent rounded-md focus:ring-2 focus:ring-highlight outline-none"
                        >
                            {gameData.characters.map((char) => (
                                <option key={char.id} value={char.id}>
                                    {char.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col space-y-2">
                        {choicesToShow.map((choice, index) => (
                            <button key={index} onClick={() => handleChoiceSelection(choice.text)} className="w-full p-3 bg-accent rounded-md text-lg text-left hover:bg-highlight">
                                {choice.text}
                            </button>
                        ))}
                    </div>
                </div>
             ) : (
                <>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <details className="flex-1">
                            <summary className="cursor-pointer text-gray-400 hover:text-white">Scene Controls</summary>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 p-2 bg-primary rounded-md">
                                <select onChange={e => handleSceneChange('background', e.target.value)} className="p-2 bg-accent rounded-md"><option value="">- Clear BG -</option>{publishedAssets.filter(a => a.type === 'background').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                                <select onChange={e => handleSceneChange('sprite', e.target.value)} className="p-2 bg-accent rounded-md" disabled={speakingCharacter.id === 'narrator'}><option value="">- Clear Sprite -</option>{charSprites.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                                <select onChange={e => handleSceneChange('cg', e.target.value)} className="p-2 bg-accent rounded-md"><option value="">- Clear CG -</option>{publishedAssets.filter(a => a.type === 'cg').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                            </div>
                        </details>
                        <details className="flex-1">
                            <summary className="cursor-pointer text-gray-400 hover:text-white">Dice Roller</summary>
                            <div className="flex items-center gap-2 mt-2 p-2 bg-primary rounded-md">
                                <span className="font-bold">d</span>
                                <input type="number" value={diceSides} onChange={e => setDiceSides(parseInt(e.target.value) || 1)} className="w-20 p-1 bg-accent rounded-md" />
                                <button onClick={handleDiceRoll} className="px-4 py-1 bg-purple-600 hover:bg-purple-700 rounded-md">Roll</button>
                            </div>
                        </details>
                    </div>
                    
                    <div className="mb-4">
                        <label htmlFor="speak-as-select" className="block text-sm font-semibold text-gray-400 mb-1">Speak As</label>
                        <select
                            id="speak-as-select"
                            value={speakingCharacterId}
                            onChange={(e) => setSpeakingCharacterId(e.target.value)}
                            className="w-full p-2 bg-accent rounded-md focus:ring-2 focus:ring-highlight outline-none"
                        >
                            {gameData.characters.map((char) => (
                                <option key={char.id} value={char.id}>
                                    {char.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex space-x-2">
                        <input type="text" value={dialogue} onChange={e => setDialogue(e.target.value)} placeholder={`What does ${speakingCharacter.name} say or do?`} className="w-full p-2 bg-accent rounded-md focus:ring-2 focus:ring-highlight outline-none" />
                        <button type="button" onClick={generateDialogue} disabled={isGenerating} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md disabled:bg-gray-500">{isGenerating ? '...' : 'AI ✨'}</button>
                    </div>

                    <div className="mt-4">
                        <p className="text-sm text-gray-400">Optionally, add choices for the next player:</p>
                        {choices.map((choice, index) => (
                            <div key={index} className="flex items-center space-x-2 mt-1">
                                <input type="text" value={choice.text} onChange={e => handleChoiceChange(index, e.target.value)} placeholder={`Choice ${index + 1}`} className="w-full p-2 bg-accent rounded-md"/>
                                <button onClick={() => handleRemoveChoice(index)} className="text-red-500 hover:text-red-400 p-2 rounded-full font-bold">X</button>
                            </div>
                        ))}
                        <button onClick={handleAddChoice} className="text-xs px-2 py-1 mt-1 bg-accent rounded-md hover:bg-opacity-75">+ Add Choice</button>
                    </div>
                    <button onClick={handleEndTurn} className="w-full mt-4 p-3 bg-highlight rounded-md text-lg font-bold hover:bg-opacity-80">Apply & End Turn</button>
                </>
             )}
        </div>
    )
}

// --- Main GameView Component ---

const GameView: React.FC<{ 
    gameData: GameData; 
    dispatch: React.Dispatch<Action>; 
    players: Player[]; 
    currentPlayer: Player; 
    currentPlayerIndex: number; 
    onEndTurn: () => void;
    gameMode: GameMode;
    myPlayerId: string | null;
}> = ({ gameData, dispatch, players, currentPlayer, currentPlayerIndex, onEndTurn, gameMode, myPlayerId }) => {
    const [baseScene, setBaseScene] = useState<SceneState>({ backgroundUrl: null, cgUrl: null, sprites: {}, dialogue: null });
    const [stagedScene, setStagedScene] = useState<Partial<SceneState>>({});
    const [activeSideTab, setActiveSideTab] = useState<'history' | 'status'>('history');
    
    const isMyTurn = (gameMode === 'local' && players.length > 0) || (gameMode === 'online-player' && currentPlayer?.id === myPlayerId);
    
    const [playbackState, setPlaybackState] = useState<'idle' | 'playing'>('idle');
    const [playbackLogIndex, setPlaybackLogIndex] = useState(0); 
    const [logsToPlay, setLogsToPlay] = useState<StoryLogEntry[]>([]);
    const turnStarted = useRef(false);

    const findAssetUrl = useCallback((id: string | null) => gameData.assets.find(a => a.id === id)?.url || null, [gameData.assets]);

    const handleSceneChange = useCallback((change: Partial<SceneState>) => {
        setStagedScene(prev => {
            const newSprites = change.sprites ? {...prev.sprites, ...change.sprites} : prev.sprites;
            return {...prev, ...change, sprites: newSprites};
        });
    }, []);

    const combinedScene = { ...baseScene, ...stagedScene, sprites: {...baseScene.sprites, ...stagedScene.sprites} };

    const reduceScene = useCallback((log: StoryLogEntry, currentScene: SceneState): SceneState => {
        const newScene = { ...currentScene, sprites: {...currentScene.sprites} };
        const assetId = 'assetId' in log ? log.assetId : null;
        switch (log.type) {
            case 'background_change': newScene.backgroundUrl = findAssetUrl(assetId); break;
            case 'sprite_change': newScene.sprites[log.characterId] = assetId; break;
            case 'cg_show': newScene.cgUrl = findAssetUrl(assetId); break;
        }
        return newScene;
    }, [findAssetUrl]);

    useEffect(() => {
        turnStarted.current = false;
        setStagedScene({});
    }, [currentPlayer]);

    useEffect(() => {
        if (turnStarted.current) return;
        turnStarted.current = true;
        
        const playerForLog = (gameMode === 'online-player') 
            ? players.find(p => p.id === myPlayerId) || { lastSeenLogIndex: 0 }
            : currentPlayer;
        
        const lastSeenIndex = playerForLog?.lastSeenLogIndex || 0;

        let initialSceneState: SceneState = { backgroundUrl: null, cgUrl: null, sprites: {}, dialogue: null };
        for(const log of gameData.storyLog.slice(0, lastSeenIndex)) {
            initialSceneState = reduceScene(log, initialSceneState);
        }
        setBaseScene(initialSceneState);

        const logsForCatchUp = gameData.storyLog.slice(lastSeenIndex);
        if (logsForCatchUp.length > 0) {
            setLogsToPlay(logsForCatchUp);
            setPlaybackLogIndex(0);
            setPlaybackState('playing');
        } else {
            setPlaybackState('idle');
            setLogsToPlay([]);
        }
    }, [gameData.storyLog, currentPlayer, reduceScene, gameMode, myPlayerId, players]);
    
    useEffect(() => {
        if (playbackState !== 'playing') return;

        if (playbackLogIndex >= logsToPlay.length) {
            setBaseScene(prev => {
                let finalScene = {...prev};
                logsToPlay.forEach(log => finalScene = reduceScene(log, finalScene));
                return {...finalScene, dialogue: null};
            });
            setPlaybackState('idle');
            setLogsToPlay([]);
            return;
        }
        
        let sceneUpdate = { ...baseScene };
        let dialogueToShow: SceneState['dialogue'] = null;

        for (let i = playbackLogIndex; i < logsToPlay.length; i++) {
            const log = logsToPlay[i];
            
            if (log.type === 'dialogue' || log.type === 'choice_selection') {
                const char = gameData.characters.find(c => c.id === log.characterId);
                dialogueToShow = { characterName: char?.name || 'Unknown', text: log.text };
                break;
            } else if (log.type === 'choice') {
                break;
            }
            sceneUpdate = reduceScene(log, sceneUpdate);
        }
        setBaseScene({ ...sceneUpdate, dialogue: dialogueToShow });

    }, [playbackState, playbackLogIndex, logsToPlay, gameData.characters, reduceScene, baseScene]);

    const handlePlaybackAdvance = () => {
        if (playbackState !== 'playing' || playbackLogIndex >= logsToPlay.length) return;
        
        let nextIndex = playbackLogIndex;
        for (let i = playbackLogIndex; i < logsToPlay.length; i++) {
            const log = logsToPlay[i];
            nextIndex = i;
            if (log.type === 'dialogue' || log.type === 'choice' || log.type === 'choice_selection') {
                break;
            }
        }
        setPlaybackLogIndex(nextIndex + 1);
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-2/3">
                    <Visuals 
                      scene={combinedScene} 
                      characters={gameData.characters} 
                      assets={gameData.assets} 
                      onClick={handlePlaybackAdvance}
                      isPlayingBack={playbackState === 'playing'}
                    />
                </div>
                <div className="w-full md:w-1/3 bg-secondary p-4 rounded-lg flex flex-col h-[75vh]">
                    <div className="flex border-b border-accent mb-2">
                        <button onClick={() => setActiveSideTab('history')} className={`px-4 py-1 ${activeSideTab === 'history' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>History</button>
                        <button onClick={() => setActiveSideTab('status')} className={`px-4 py-1 ${activeSideTab === 'status' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Status & Quests</button>
                    </div>
                    {activeSideTab === 'history' && <HistoryLogContent gameData={gameData} />}
                    {activeSideTab === 'status' && <StatusContent gameData={gameData} />}
                </div>
            </div>
            {gameMode !== 'online-gm' && (
              <InputController 
                  dispatch={dispatch}
                  gameData={gameData}
                  onEndTurn={onEndTurn}
                  isMyTurn={isMyTurn}
                  currentPlayer={currentPlayer}
                  currentPlayerIndex={currentPlayerIndex}
                  onSceneChange={handleSceneChange}
                  isPlayingBack={playbackState === 'playing'}
              />
            )}
            {gameMode === 'online-gm' && (
                <div className="bg-secondary p-4 rounded-lg mt-4 text-center text-gray-400">
                    You are spectating as the Game Master.
                </div>
            )}
        </div>
    );
};

export default GameView;