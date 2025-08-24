import React, { useState } from 'react';
import { Character, Asset } from '../types';
import { PREMADE_BIOS } from '../premadeData';

interface CharacterEditorProps {
    char: Character;
    allSprites: Asset[];
    updateCharacter: (char: Character) => void;
    onDeleteCharacter: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const CharacterEditor: React.FC<CharacterEditorProps> = ({ char, allSprites, updateCharacter, onDeleteCharacter }) => {
    const [selectedBioGenre, setSelectedBioGenre] = useState(Object.keys(PREMADE_BIOS)[0]);

    const assignedSprites = allSprites.filter(s => (char.spriteAssetIds || []).includes(s.id));
    const availableSprites = allSprites.filter(s => !(char.spriteAssetIds || []).includes(s.id));

    const handleAssignSprite = (spriteId: string) => {
        updateCharacter({ ...char, spriteAssetIds: [...(char.spriteAssetIds || []), spriteId] });
    };

    const handleUnassignSprite = (spriteId: string) => {
        updateCharacter({ ...char, spriteAssetIds: (char.spriteAssetIds || []).filter(id => id !== spriteId) });
    };
    
    const handleGenerateBio = () => {
        const bios = PREMADE_BIOS[selectedBioGenre] || [];
        if (bios.length > 0) {
            const randomBio = bios[Math.floor(Math.random() * bios.length)];
            updateCharacter({ ...char, bio: randomBio });
        }
    };

    return (
        <div className="bg-accent p-4 rounded-lg space-y-3 relative">
            <button data-id={char.id} onClick={onDeleteCharacter} className="absolute top-2 right-2 text-red-500 hover:text-red-400 p-1 rounded-full font-bold z-10">X</button>
            <input value={char.name} onChange={e => updateCharacter({ ...char, name: e.target.value })} className="w-full p-2 bg-primary rounded-md font-bold" placeholder="Character Name" />
            
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-400">Health (HP)</label>
                    <div className="flex items-center gap-1">
                    <input type="number" value={char.health} onChange={e => updateCharacter({ ...char, health: Math.max(0, parseInt(e.target.value) || 0) })} className="w-full p-1 text-sm bg-primary rounded-md" />
                    <span className="text-gray-400">/</span>
                    <input type="number" value={char.maxHealth} onChange={e => updateCharacter({ ...char, maxHealth: Math.max(1, parseInt(e.target.value) || 1) })} className="w-full p-1 text-sm bg-primary rounded-md" />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-400">Mana (MP)</label>
                    <div className="flex items-center gap-1">
                    <input type="number" value={char.mana} onChange={e => updateCharacter({ ...char, mana: Math.max(0, parseInt(e.target.value) || 0) })} className="w-full p-1 text-sm bg-primary rounded-md" />
                     <span className="text-gray-400">/</span>
                    <input type="number" value={char.maxMana} onChange={e => updateCharacter({ ...char, maxMana: Math.max(0, parseInt(e.target.value) || 0) })} className="w-full p-1 text-sm bg-primary rounded-md" />
                    </div>
                </div>
            </div>

            <div>
                <textarea value={char.bio} onChange={e => updateCharacter({ ...char, bio: e.target.value })} className="w-full p-2 bg-primary rounded-md h-20" placeholder="Character Bio" />
                 <div className="flex items-center gap-2 mt-1">
                    <select onChange={e => setSelectedBioGenre(e.target.value)} value={selectedBioGenre} className="text-xs p-1 bg-primary rounded-md">
                        {Object.keys(PREMADE_BIOS).map(genre => <option key={genre} value={genre}>{genre}</option>)}
                    </select>
                    <button onClick={handleGenerateBio} className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded-md">
                        Suggest Premade Bio
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h4 className="text-sm font-semibold mb-1">Assigned Sprites</h4>
                    <div className="bg-primary p-2 rounded-md min-h-[100px] space-y-1">
                        {assignedSprites.map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-secondary p-1 rounded">
                                <span className="text-xs truncate">{s.name}</span>
                                <button onClick={() => handleUnassignSprite(s.id)} className="text-xs text-red-400 hover:text-red-300 px-1">Unassign</button>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h4 className="text-sm font-semibold mb-1">Available Sprites</h4>
                    <div className="bg-primary p-2 rounded-md min-h-[100px] space-y-1 max-h-[150px] overflow-y-auto">
                         {availableSprites.map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-secondary p-1 rounded">
                                <span className="text-xs truncate">{s.name}</span>
                                <button onClick={() => handleAssignSprite(s.id)} className="text-xs text-green-400 hover:text-green-300 px-1">Assign</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterEditor;