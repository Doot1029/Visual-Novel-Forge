import React, { useState, useRef, useEffect } from 'react';
import { GameData, Player, AssetType, Character, Asset } from '../types';
import { Action } from '../state/reducer';
import { MAX_PLAYERS } from '../constants';
import { PREMADE_PROMPTS } from '../premadeData';
import PremadeAssetBrowser from './PremadeAssetBrowser';
import CharacterEditor from './CharacterEditor';

interface SetupViewProps {
  gameData: GameData;
  dispatch: React.Dispatch<Action>;
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  onStartLocalGame: () => void;
  onHostOnlineGame: () => void;
  onJoinOnlineGame: (gameId: string, playerName: string) => void;
  gameId: string | null;
  onStartGameForEveryone: () => void;
}

const GameSetup: React.FC<Omit<SetupViewProps, 'onHostOnlineGame' | 'onJoinOnlineGame' | 'gameId' | 'onStartGameForEveryone' | 'onStartLocalGame'> & { onStartGame: () => void, isOnline: boolean }> = ({ gameData, dispatch, players, setPlayers, onStartGame, isOnline }) => {
    const [activeTab, setActiveTab] = useState('game');
    const [selectedPromptGenre, setSelectedPromptGenre] = useState(Object.keys(PREMADE_PROMPTS)[0]);
    const [assetUrl, setAssetUrl] = useState('');
    const [assetName, setAssetName] = useState('');
    const [assetType, setAssetType] = useState<AssetType>('background');
    

    const handlePlayerNameChange = (id: string, name: string) => {
        setPlayers(players.map(p => p.id === id ? {...p, name} : p));
    }

    const addPlayer = () => {
        if (players.length < MAX_PLAYERS) {
            const newPlayer: Player = { id: `p-${Date.now()}`, name: `Player ${players.length + 1}`, lastSeenLogIndex: 0 };
            setPlayers([...players, newPlayer]);
        }
    }
    const removePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id));
    }

    const addNewCharacter = () => {
        dispatch({ type: 'ADD_CHARACTER', payload: { name: 'New Character', bio: '', spriteAssetIds: [] } });
    }

    const updateCharacter = (character: Character) => {
        dispatch({ type: 'UPDATE_CHARACTER', payload: character });
    }

    const handleDeleteCharacter = (e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id && window.confirm('Are you sure you want to delete this character?')) {
            dispatch({ type: 'DELETE_CHARACTER', payload: { id } });
        }
    };
    
    const handleDeleteAsset = (e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id && window.confirm('Are you sure you want to delete this asset?')) {
            dispatch({ type: 'DELETE_ASSET', payload: { id } });
        }
    };

    const handleSetAssetPublished = (id: string, isPublished: boolean) => {
        dispatch({ type: 'SET_ASSET_PUBLISHED', payload: { id, isPublished } });
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: AssetType) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const url = e.target?.result as string;
                dispatch({ type: 'ADD_ASSET', payload: { type, url, name: file.name, isPublished: true } });
            };
            reader.readAsDataURL(file);
        }
        event.target.value = ''; // Reset file input
    };
    
    const handleGeneratePrompt = () => {
        const prompts = PREMADE_PROMPTS[selectedPromptGenre] || [];
        if (prompts.length > 0) {
            const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
            dispatch({ type: 'UPDATE_STORY_PROMPT', payload: randomPrompt });
        }
    };
    
    const handleAddAssetFromUrl = () => {
        if (!assetUrl.trim() || !assetName.trim()) {
          alert('Please provide a valid URL and a name for the asset.');
          return;
        }
        try {
          new URL(assetUrl);
        } catch (_) {
          alert('Please enter a valid URL.');
          return;
        }

        dispatch({ type: 'ADD_ASSET', payload: { url: assetUrl, name: assetName, type: assetType, isPublished: true } });
        setAssetUrl('');
        setAssetName('');
    };


    return (
        <>
            <div className="flex border-b border-accent mb-4">
                <button onClick={() => setActiveTab('game')} className={`px-4 py-2 ${activeTab === 'game' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Game & Players</button>
                <button onClick={() => setActiveTab('characters')} className={`px-4 py-2 ${activeTab === 'characters' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Characters</button>
                <button onClick={() => setActiveTab('assets')} className={`px-4 py-2 ${activeTab === 'assets' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Assets</button>
            </div>

            {activeTab === 'game' && (
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-lg font-semibold text-highlight">Story Prompt</label>
                             <div className="flex items-center gap-2">
                                <select onChange={e => setSelectedPromptGenre(e.target.value)} value={selectedPromptGenre} className="text-xs p-1 bg-accent rounded-md">
                                    {Object.keys(PREMADE_PROMPTS).map(genre => <option key={genre} value={genre}>{genre}</option>)}
                                </select>
                                <button onClick={handleGeneratePrompt} className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded-md">
                                    Generate
                                </button>
                            </div>
                        </div>
                        <textarea value={gameData.storyPrompt} onChange={e => dispatch({type: 'UPDATE_STORY_PROMPT', payload: e.target.value})} className="w-full mt-1 p-2 bg-accent rounded-md h-24 focus:ring-2 focus:ring-highlight outline-none" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-highlight mb-2">Players</h3>
                        { isOnline ? (
                            <div className="bg-accent p-3 rounded-md text-sm text-gray-300">
                                Players will join using the Game ID after you start hosting. You will be able to see them join in the lobby.
                            </div>
                        ) : (
                           <>
                            <div className="space-y-2">
                            {players.map(player => (
                                <div key={player.id} className="flex items-center space-x-2 bg-accent p-2 rounded">
                                    <input type="text" value={player.name} onChange={e => handlePlayerNameChange(player.id, e.target.value)} className="p-2 bg-primary rounded-md flex-grow" placeholder="Player Name"/>
                                    <button onClick={() => removePlayer(player.id)} className="text-red-500 hover:text-red-400 p-2 rounded-full font-bold">X</button>
                                </div>
                            ))}
                            </div>
                            <button onClick={addPlayer} disabled={players.length >= MAX_PLAYERS} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-500">Add Player Slot</button>
                           </>
                        )}
                    </div>
                </div>
            )}
            
            {activeTab === 'characters' && (
                <div className="space-y-4">
                     {gameData.characters.filter(c => c.id !== 'narrator').map(char => (
                        <CharacterEditor 
                            key={char.id}
                            char={char}
                            allSprites={gameData.assets.filter(a => a.type === 'characterSprite')}
                            updateCharacter={updateCharacter}
                            onDeleteCharacter={handleDeleteCharacter}
                        />
                     ))}
                     <button onClick={addNewCharacter} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md">Add New Character</button>
                </div>
            )}
            
            {activeTab === 'assets' && (
                <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-2 text-highlight">Upload Files</h3>
                      <div className="flex flex-wrap gap-4">
                        <label className="px-4 py-2 bg-accent hover:bg-opacity-75 rounded-md cursor-pointer">Upload Background <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'background')} /></label>
                        <label className="px-4 py-2 bg-accent hover:bg-opacity-75 rounded-md cursor-pointer">Upload Sprite <input type="file" className="hidden" accept="image/*,.webp" onChange={e => handleFileChange(e, 'characterSprite')} /></label>
                        <label className="px-4 py-2 bg-accent hover:bg-opacity-75 rounded-md cursor-pointer">Upload CG <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'cg')} /></label>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-highlight">Add from URL</h3>
                      <div className="bg-accent p-3 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                            <div className="md:col-span-2 grid grid-cols-2 gap-2">
                            <div>
                                <label htmlFor="asset-url-setup" className="text-xs text-gray-400 block mb-1">Image URL</label>
                                <input
                                id="asset-url-setup"
                                type="url"
                                value={assetUrl}
                                onChange={(e) => setAssetUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full p-2 text-sm bg-primary rounded-md"
                                />
                            </div>
                            <div>
                                <label htmlFor="asset-name-setup" className="text-xs text-gray-400 block mb-1">Asset Name</label>
                                <input
                                id="asset-name-setup"
                                type="text"
                                value={assetName}
                                onChange={(e) => setAssetName(e.target.value)}
                                placeholder="e.g., Cool Castle"
                                className="w-full p-2 text-sm bg-primary rounded-md"
                                />
                            </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="asset-type-setup" className="text-xs text-gray-400 block mb-1">Asset Type</label>
                                    <select
                                        id="asset-type-setup"
                                        value={assetType}
                                        onChange={(e) => setAssetType(e.target.value as AssetType)}
                                        className="w-full p-2 text-sm bg-primary rounded-md h-[40px]"
                                    >
                                        <option value="background">Background</option>
                                        <option value="characterSprite">Sprite</option>
                                        <option value="cg">CG</option>
                                    </select>
                                </div>
                                <button
                                onClick={handleAddAssetFromUrl}
                                className="px-4 py-2 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80 disabled:bg-gray-500 h-[40px]"
                                >
                                Add
                                </button>
                            </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                        <h3 className="font-semibold mb-2 text-highlight">Add from Asset Library</h3>
                        <PremadeAssetBrowser onAddAsset={(asset) => dispatch({ type: 'ADD_ASSET', payload: asset })} />
                    </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {gameData.assets.map(asset => (
                            <div key={asset.id} className="bg-accent p-2 rounded-lg relative">
                                <div className="absolute top-1 right-1 flex gap-1 z-10">
                                    <button 
                                        onClick={() => handleSetAssetPublished(asset.id, !asset.isPublished)} 
                                        className={`bg-black bg-opacity-50 rounded-full w-6 h-6 flex items-center justify-center font-bold ${asset.isPublished ? 'text-yellow-400' : 'text-gray-500'}`}
                                        title={asset.isPublished ? 'Unpublish' : 'Publish'}
                                    >
                                        ⭐
                                    </button>
                                    <button data-id={asset.id} onClick={handleDeleteAsset} className="bg-black bg-opacity-50 text-red-500 rounded-full w-6 h-6 flex items-center justify-center font-bold">&times;</button>
                                </div>
                                <img src={asset.url} alt={asset.name} className="w-full h-32 object-cover rounded-md mb-2" />
                                <p className="text-sm truncate" title={asset.name}>{asset.name}</p>
                                <p className="text-xs text-gray-400 capitalize">{asset.type.replace('Sprite', ' Sprite')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 text-center flex flex-col sm:flex-row justify-center gap-4 items-center">
                <button 
                    onClick={onStartGame} 
                    className="px-8 py-4 bg-highlight text-white text-xl font-bold rounded-lg hover:bg-opacity-80 transition-transform hover:scale-105">
                        {isOnline ? 'Host Game & Get ID' : 'Start Local Game'}
                </button>
            </div>
        </>
    );
}


const SetupView: React.FC<SetupViewProps> = (props) => {
    const [mode, setMode] = useState<'menu' | 'local' | 'host' | 'join'>('menu');
    const [joinGameId, setJoinGameId] = useState('');
    const [joinPlayerName, setJoinPlayerName] = useState('');

    const handleJoin = () => {
        if (joinGameId.trim() && joinPlayerName.trim()) {
            props.onJoinOnlineGame(joinGameId.trim(), joinPlayerName.trim());
        } else {
            alert('Please enter your name and a valid Game ID.');
        }
    };
    
    if (props.gameId && mode === 'host') {
        return (
             <div className="bg-secondary p-8 rounded-lg text-center">
                <h2 className="text-2xl font-bold text-highlight mb-4">Online Game Hosted!</h2>
                <p className="mb-4">Share the Game ID below with your players so they can join.</p>
                <div className="bg-primary p-4 rounded-lg">
                    <p className="text-lg text-gray-400 mb-2">Game ID:</p>
                    <input 
                        type="text" 
                        readOnly 
                        value={props.gameId} 
                        className="w-full max-w-sm mx-auto text-center p-2 text-2xl font-mono bg-accent rounded-md"
                        onFocus={(e) => e.target.select()}
                    />
                </div>
                 <div className="mt-6 w-full max-w-sm mx-auto">
                    <h3 className="text-xl font-semibold mb-2">Players Joined ({props.players.length})</h3>
                    <div className="max-h-48 overflow-y-auto bg-primary p-2 rounded-md space-y-1 text-left">
                        {props.players.length === 0 ? (
                            <p className="text-gray-400 italic text-center">Waiting for players...</p>
                        ) : (
                            props.players.map(p => (
                                <div key={p.id} className="bg-accent p-2 rounded">{p.name}</div>
                            ))
                        )}
                    </div>
                </div>
                <button
                    onClick={props.onStartGameForEveryone}
                    disabled={props.players.length === 0}
                    className="mt-6 px-8 py-4 bg-highlight text-white text-xl font-bold rounded-lg hover:bg-opacity-80 transition-transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    title={props.players.length === 0 ? "Waiting for at least one player to join" : "Start the game"}
                >
                    Start Game for Everyone
                </button>
            </div>
        )
    }

    const renderContent = () => {
        switch (mode) {
            case 'local':
                return <GameSetup {...props} onStartGame={props.onStartLocalGame} isOnline={false} />;
            case 'host':
                 return <GameSetup {...props} onStartGame={props.onHostOnlineGame} isOnline={true} />;
            case 'join':
                return (
                    <div className="bg-accent p-8 rounded-lg max-w-md mx-auto">
                        <h2 className="text-2xl font-bold text-highlight mb-4">Join Online Game</h2>
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={joinPlayerName}
                                onChange={(e) => setJoinPlayerName(e.target.value)}
                                placeholder="Your Name"
                                className="w-full p-3 bg-primary rounded-md focus:ring-2 focus:ring-highlight outline-none"
                            />
                            <input
                                type="text"
                                value={joinGameId}
                                onChange={(e) => setJoinGameId(e.target.value)}
                                placeholder="Enter Game ID"
                                className="w-full p-3 bg-primary rounded-md focus:ring-2 focus:ring-highlight outline-none"
                            />
                            <button onClick={handleJoin} className="w-full p-3 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80">
                                Join Game
                            </button>
                        </div>
                         <button onClick={() => setMode('menu')} className="text-sm mt-4 text-gray-400 hover:text-white">← Back to menu</button>
                    </div>
                );
            case 'menu':
            default:
                return (
                    <div className="text-center">
                         <h2 className="text-3xl font-bold text-highlight mb-6">Welcome to the Forge</h2>
                         <div className="flex flex-col md:flex-row justify-center gap-4">
                             <button onClick={() => setMode('local')} className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700 transition-transform hover:scale-105">
                                Start Local Game
                            </button>
                            <button onClick={() => setMode('host')} className="px-8 py-4 bg-purple-600 text-white text-xl font-bold rounded-lg hover:bg-purple-700 transition-transform hover:scale-105">
                                Host Online Game
                            </button>
                             <button onClick={() => setMode('join')} className="px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-lg hover:bg-green-700 transition-transform hover:scale-105">
                                Join Online Game
                            </button>
                         </div>
                    </div>
                );
        }
    }
    
    return <div className="bg-secondary p-6 rounded-lg relative">{renderContent()}</div>;
}

export default SetupView;
