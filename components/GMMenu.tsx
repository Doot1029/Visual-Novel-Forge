import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameData, Player, AssetType, Asset, Character, StoryLogEntry, Quest } from '../types';
import { Action } from '../state/reducer';
import { MAX_PLAYERS } from '../constants';
import PremadeAssetBrowser from './PremadeAssetBrowser';
import CharacterEditor from './CharacterEditor';

interface GMMenuProps {
  isOpen: boolean;
  onClose: () => void;
  gameData: GameData;
  dispatch: React.Dispatch<Action>;
  gameId: string | null;
  onPreviewAsset: (asset: Asset) => void;
}

// --- Types for Scene State for video export ---
interface SceneState {
  backgroundUrl: string | null;
  cgUrl: string | null;
  sprites: { [characterId: string]: { assetId: string | null, url: string | null } };
  dialogue: { characterName: string; text: string } | null;
}

const VIDEO_QUALITY_BITRATES: Record<string, number> = {
    low: 1_000_000, // 1 Mbps
    medium: 2_500_000, // 2.5 Mbps
    high: 5_000_000, // 5 Mbps
    ultra: 8_000_000, // 8 Mbps
};

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    const initialY = y;
    for (const l of lines) {
        context.fillText(l.trim(), x, y);
        y += lineHeight;
    }
    return y - initialY; // Return the total height of the wrapped text
}


async function drawSceneOnCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    scene: SceneState,
    loadedImages: Map<string, HTMLImageElement>
) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (scene.backgroundUrl) {
        const bgImg = loadedImages.get(scene.backgroundUrl);
        if (bgImg) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    }

    const activeSprites = Object.values(scene.sprites)
        .map(spriteInfo => loadedImages.get(spriteInfo.url || ''))
        .filter((img): img is HTMLImageElement => !!img);
    
    if (activeSprites.length > 0) {
        const spriteContainerHeight = canvas.height * 0.8;
        const scaledSprites = activeSprites.map(img => {
            const scale = spriteContainerHeight / img.naturalHeight;
            return { img, width: img.naturalWidth * scale, height: spriteContainerHeight };
        });

        const totalWidth = scaledSprites.reduce((sum, s) => sum + s.width, 0);
        let currentX = (canvas.width - totalWidth) / 2;
        const yPos = canvas.height - spriteContainerHeight;
        
        for (const sprite of scaledSprites) {
            ctx.drawImage(sprite.img, currentX, yPos, sprite.width, sprite.height);
            currentX += sprite.width;
        }
    }

    if (scene.cgUrl) {
        const cgImg = loadedImages.get(scene.cgUrl);
        if (cgImg) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const canvasAspect = canvas.width / canvas.height;
            const imgAspect = cgImg.naturalWidth / cgImg.naturalHeight;
            let drawWidth = canvas.width;
            let drawHeight = canvas.height;
            if (imgAspect > canvasAspect) {
                drawHeight = canvas.width / imgAspect;
            } else {
                drawWidth = canvas.height * imgAspect;
            }
            const drawX = (canvas.width - drawWidth) / 2;
            const drawY = (canvas.height - drawHeight) / 2;
            ctx.drawImage(cgImg, drawX, drawY, drawWidth, drawHeight);
        }
    }

    if (scene.dialogue) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);
        
        const padding = 20;
        const x = padding;
        const yName = canvas.height * 0.7 + padding + 24;
        const yText = yName + 40;
        
        ctx.fillStyle = '#e94560';
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(scene.dialogue.characterName, x, yName);

        ctx.fillStyle = '#dcdcdc';
        ctx.font = '24px Inter, sans-serif';
        wrapText(ctx, scene.dialogue.text, x, yText, canvas.width - (padding * 2), 30);
    }
}


const GMMenu: React.FC<GMMenuProps> = ({ isOpen, onClose, gameData, dispatch, gameId, onPreviewAsset }) => {
    const [activeTab, setActiveTab] = useState('game');
    const [assetUrl, setAssetUrl] = useState('');
    const [assetName, setAssetName] = useState('');
    const [assetType, setAssetType] = useState<AssetType>('background');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [timingBaseSeconds, setTimingBaseSeconds] = useState(2.5);
    const [timingSecondsPerWord, setTimingSecondsPerWord] = useState(0.25);
    const [videoQuality, setVideoQuality] = useState('high');
    const [newQuestTitle, setNewQuestTitle] = useState('');
    const [newQuestDesc, setNewQuestDesc] = useState('');
    const [newQuestAssignee, setNewQuestAssignee] = useState<string>('null');
    const [newQuestCoins, setNewQuestCoins] = useState(0);
    const { players } = gameData;
    
    const handlePlayerUpdate = (id: string, key: keyof Player, value: string | number) => {
        const player = players.find(p => p.id === id);
        if (player) {
            dispatch({ type: 'UPDATE_PLAYER', payload: {...player, [key]: value} });
        }
    }

    const addPlayer = () => {
        const newPlayer: Player = { id: `p-${Date.now()}`, name: `Player ${players.length + 1}`, lastSeenLogIndex: 0, coins: 0 };
        dispatch({ type: 'ADD_PLAYER', payload: newPlayer });
    }
    const removePlayer = (id: string) => {
        const playerToRemove = players.find(p => p.id === id);
        const playerName = playerToRemove?.name || 'this player';
        
        if (window.confirm(`Are you sure you want to remove ${playerName}?`)) {
            if (playerToRemove) {
                dispatch({
                    type: 'ADD_LOG_ENTRY',
                    payload: {
                        type: 'stat_change',
                        text: `(${playerToRemove.name}) Has Left the Game!`
                    }
                });
            }
            dispatch({ type: 'REMOVE_PLAYER', payload: { id } });
        }
    }

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
        event.target.value = '';
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

    const handleAddAssetCollection = (assets: Omit<Asset, 'id' | 'isPublished'>[]) => {
        dispatch({ type: 'BATCH_ADD_ASSETS', payload: assets.map(a => ({ ...a, isPublished: true })) });
    };

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
    
    const handleAddQuest = () => {
        if (!newQuestTitle.trim()) {
            alert("Quest title cannot be empty.");
            return;
        }
        const questPayload: Omit<Quest, 'id' | 'status'> = {
            title: newQuestTitle,
            description: newQuestDesc,
            assignedCharacterId: newQuestAssignee === 'null' ? null : newQuestAssignee,
            rewards: {
                coins: newQuestCoins,
            }
        };
        dispatch({ type: 'ADD_QUEST', payload: questPayload });
        dispatch({ type: 'ADD_LOG_ENTRY', payload: {type: 'quest_status', text: `New Quest Added: ${newQuestTitle}`}});
        
        setNewQuestTitle('');
        setNewQuestDesc('');
        setNewQuestAssignee('null');
        setNewQuestCoins(0);
    };
    
    const handleUpdateQuestStatus = (id: string, status: 'completed' | 'active') => {
        dispatch({type: 'UPDATE_QUEST', payload: {id, status}});
    }

    const findAssetUrl = useCallback((id: string | null) => gameData.assets.find(a => a.id === id)?.url || null, [gameData.assets]);

    const reduceScene = useCallback((log: StoryLogEntry, currentScene: SceneState): SceneState => {
        const newScene: SceneState = { ...currentScene, sprites: { ...currentScene.sprites } };
        switch (log.type) {
            case 'background_change': 
                newScene.backgroundUrl = findAssetUrl(log.assetId); 
                break;
            case 'sprite_change': 
                 newScene.sprites[log.characterId] = { assetId: log.assetId, url: findAssetUrl(log.assetId) };
                 break;
            case 'cg_show': 
                newScene.cgUrl = findAssetUrl(log.assetId); 
                break;
        }
        return newScene;
    }, [findAssetUrl]);
    
    const handleExportVideo = async () => {
        setIsExporting(true);
        setExportProgress(0);

        const canvas = canvasRef.current;
        if (!canvas) {
            alert('Canvas element not found.');
            setIsExporting(false);
            return;
        }
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            alert('Could not get canvas context.');
            setIsExporting(false);
            return;
        }

        try {
            setExportProgress(5);
            const imageUrls = new Set(gameData.assets.map(a => a.url));
            const loadedImages = new Map<string, HTMLImageElement>();
            const promises = Array.from(imageUrls).map(url => new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                if (url.startsWith('data:')) {
                    img.src = url;
                } else {
                    const cleanUrl = url.replace(/^https?:\/\//, '');
                    img.src = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
                }
                img.onload = () => { loadedImages.set(url, img); resolve(); };
                img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            }));
            await Promise.all(promises);
            setExportProgress(10);
            
            const stream = canvas.captureStream(24);
            const bitrate = VIDEO_QUALITY_BITRATES[videoQuality];
            const recorder = new MediaRecorder(stream, { 
                mimeType: 'video/webm',
                videoBitsPerSecond: bitrate,
            });
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const videoBlob = new Blob(chunks, { type: 'video/webm' });
                const videoUrl = URL.createObjectURL(videoBlob);
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = `${gameData.title.replace(/[^a-z0-9]/gi, '_')}.webm`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(videoUrl);
                document.body.removeChild(a);
                setIsExporting(false);
                setExportProgress(100);
            };
            recorder.start();

            let currentScene: SceneState = { backgroundUrl: null, cgUrl: null, sprites: {}, dialogue: null };
            let sceneChangesSinceLastPause = false;

            for (let i = 0; i < gameData.storyLog.length; i++) {
                const log = gameData.storyLog[i];

                if (log.type === 'background_change' || log.type === 'sprite_change' || log.type === 'cg_show') {
                    currentScene = reduceScene(log, currentScene);
                    sceneChangesSinceLastPause = true;
                } else if (log.type === 'dialogue' || log.type === 'choice_selection') {
                    if (sceneChangesSinceLastPause) {
                        await drawSceneOnCanvas(ctx, canvas, { ...currentScene, dialogue: null }, loadedImages);
                        await new Promise(res => setTimeout(res, 500));
                        sceneChangesSinceLastPause = false;
                    }

                    let dialogueText = "";
                    let dialogueToShow = null;
                    if (log.type === 'dialogue') {
                        const char = gameData.characters.find(c => c.id === log.characterId);
                        dialogueToShow = { characterName: char?.name || 'Narrator', text: log.text };
                        dialogueText = log.text;
                    } else if (log.type === 'choice_selection') {
                        const player = gameData.players.find(p => p.id === log.playerId);
                        const fullText = `${player?.name || 'A player'} chose: "${log.choice.text}"`;
                        dialogueToShow = { characterName: 'Narrator', text: fullText };
                        dialogueText = fullText;
                    }
                    
                    await drawSceneOnCanvas(ctx, canvas, { ...currentScene, dialogue: dialogueToShow }, loadedImages);
                    
                    const wordCount = dialogueText.split(/\s+/).filter(Boolean).length;
                    const durationMs = (timingBaseSeconds + wordCount * timingSecondsPerWord) * 1000;
                    await new Promise(res => setTimeout(res, Math.max(500, durationMs)));
                }
                
                setExportProgress(10 + (i / gameData.storyLog.length) * 80);
            }

            if (sceneChangesSinceLastPause || gameData.storyLog.length > 0) {
                await drawSceneOnCanvas(ctx, canvas, { ...currentScene, dialogue: null }, loadedImages);
                await new Promise(res => setTimeout(res, 2000));
            }
            
            setExportProgress(90);
            
            // --- Credits Sequence ---
            const credits = [
                { type: 'spacer', size: 60 },
                { type: 'header', text: 'Game Master' },
                { type: 'item', text: 'The Host' },
                { type: 'spacer', size: 40 },
                { type: 'header', text: 'Players' },
                ...(gameData.players.length > 0 ? gameData.players.map(p => ({ type: 'item', text: p.name })) : [{ type: 'item', text: 'No players'}]),
                { type: 'spacer', size: 40 },
                { type: 'header', text: 'Characters' },
                ...gameData.characters.filter(c => c.id !== 'narrator' && c.status === 'active').map(c => ({ type: 'item', text: c.name })),
                { type: 'spacer', size: 80 },
                { type: 'footer', text: 'This video was brought to you by a multiplayer roleplaying visual novel game called "Visual Novel Forge".' },
                { type: 'spacer', size: 40 },
                { type: 'ender', text: 'Thanks for watching!' },
            ];
            
            let totalHeight = 0;
            credits.forEach(c => {
                 switch (c.type) {
                    case 'spacer': totalHeight += c.size; break;
                    case 'header': totalHeight += 40; break;
                    case 'item': totalHeight += 30; break;
                    case 'footer': totalHeight += 50; break;
                    case 'ender': totalHeight += 80; break;
                }
            });

            const scrollDuration = (totalHeight + canvas.height) / 80; // pixels per second
            const frames = Math.floor(scrollDuration * 24);
            const startY = canvas.height;
            const endY = -totalHeight;

            for (let i = 0; i <= frames; i++) {
                const progress = i / frames;
                const currentY = startY + (endY - startY) * progress;

                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                let y = currentY;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                for (const credit of credits) {
                    if (credit.type === 'spacer') {
                        y += credit.size;
                    } else {
                        if (credit.type === 'header') {
                            ctx.font = 'bold 32px Inter, sans-serif';
                            ctx.fillStyle = '#e94560'; // highlight
                            ctx.fillText(credit.text, canvas.width / 2, y);
                            y += 40;
                        } else if (credit.type === 'item') {
                            ctx.font = '24px Inter, sans-serif';
                            ctx.fillStyle = '#dcdcdc'; // light
                            ctx.fillText(credit.text, canvas.width / 2, y);
                            y += 30;
                        } else if (credit.type === 'footer') {
                            ctx.font = 'italic 18px Inter, sans-serif';
                            ctx.fillStyle = '#dcdcdc'; // light
                            const height = wrapText(ctx, credit.text, canvas.width / 2, y, canvas.width * 0.8, 24);
                            y += height + 20;
                        } else if (credit.type === 'ender') {
                            ctx.font = 'bold 40px Inter, sans-serif';
                            ctx.fillStyle = '#e94560'; // highlight
                            ctx.fillText(credit.text, canvas.width / 2, y);
                            y += 80;
                        }
                    }
                }
                setExportProgress(90 + (progress * 10));
                await new Promise(res => setTimeout(res, 1000 / 24));
            }

            recorder.stop();
        } catch(error) {
            console.error("Video export failed:", error);
            alert(`Video export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsExporting(false);
        }
    };


    if (!isOpen) return null;

    const approvals = gameData.pendingAssetApprovals || [];

    return (
        <div className="fixed inset-0 bg-primary bg-opacity-90 z-50 flex items-center justify-center p-4">
            <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col relative border-2 border-accent">
                <button onClick={onClose} className="absolute top-2 right-2 text-light hover:text-highlight text-3xl font-bold">&times;</button>
                <h2 className="text-2xl font-bold text-highlight p-4 border-b border-accent">Game Master Actions</h2>
                
                <div className="flex border-b border-accent">
                    <button onClick={() => setActiveTab('game')} className={`px-4 py-2 ${activeTab === 'game' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Game</button>
                    <button onClick={() => setActiveTab('characters')} className={`px-4 py-2 ${activeTab === 'characters' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Characters</button>
                    <button onClick={() => setActiveTab('assets')} className={`px-4 py-2 ${activeTab === 'assets' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Assets</button>
                    <button onClick={() => setActiveTab('players')} className={`px-4 py-2 ${activeTab === 'players' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Players</button>
                     <button onClick={() => setActiveTab('approvals')} className={`px-4 py-2 relative ${activeTab === 'approvals' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>
                        Approvals
                        {approvals.length > 0 && <span className="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{approvals.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('export')} className={`px-4 py-2 ${activeTab === 'export' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Export</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                     {activeTab === 'game' && (
                        <div className="space-y-6">
                            {gameId && (
                                <div>
                                    <h3 className="text-xl font-semibold text-highlight mb-2">Game ID</h3>
                                    <div className="bg-accent p-3 rounded-lg flex items-center gap-4">
                                        <input
                                            type="text"
                                            readOnly
                                            value={gameId}
                                            className="w-full text-center p-2 text-2xl font-mono bg-primary rounded-md"
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <button
                                            onClick={() => navigator.clipboard.writeText(gameId)}
                                            className="px-4 py-2 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Share this ID with players so they can join.</p>
                                </div>
                            )}
                            <div>
                                <h3 className="text-xl font-semibold text-highlight mb-2">Quests</h3>
                                <div className="bg-accent p-4 rounded-lg space-y-3 mb-4">
                                    <h4 className="font-bold">Add New Quest</h4>
                                    <input type="text" placeholder="Quest Title" value={newQuestTitle} onChange={e => setNewQuestTitle(e.target.value)} className="w-full p-2 bg-primary rounded-md"/>
                                    <textarea placeholder="Description" value={newQuestDesc} onChange={e => setNewQuestDesc(e.target.value)} className="w-full p-2 bg-primary rounded-md h-20"/>
                                    <select value={newQuestAssignee} onChange={e => setNewQuestAssignee(e.target.value)} className="w-full p-2 bg-primary rounded-md">
                                        <option value="null">Assign to... (Optional)</option>
                                        {gameData.characters.filter(c => c.id !== 'narrator').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <div>
                                        <label className="text-sm">Coin Reward:</label>
                                        <input type="number" value={newQuestCoins} onChange={e => setNewQuestCoins(parseInt(e.target.value) || 0)} className="w-full p-2 bg-primary rounded-md"/>
                                    </div>
                                    <button onClick={handleAddQuest} className="w-full p-2 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80">Add Quest</button>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-2">Active Quests</h4>
                                    {gameData.quests.filter(q => q.status === 'active').map(quest => (
                                        <div key={quest.id} className="bg-accent p-2 rounded flex justify-between items-center mb-1">
                                            <span>{quest.title}</span>
                                            <button onClick={() => handleUpdateQuestStatus(quest.id, 'completed')} className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded">Complete</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
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
                                            <label htmlFor="asset-url-gm" className="text-xs text-gray-400 block mb-1">Image URL</label>
                                            <input
                                            id="asset-url-gm"
                                            type="url"
                                            value={assetUrl}
                                            onChange={(e) => setAssetUrl(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full p-2 text-sm bg-primary rounded-md"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="asset-name-gm" className="text-xs text-gray-400 block mb-1">Asset Name</label>
                                            <input
                                            id="asset-name-gm"
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
                                                <label htmlFor="asset-type-gm" className="text-xs text-gray-400 block mb-1">Asset Type</label>
                                                <select
                                                    id="asset-type-gm"
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
                                <PremadeAssetBrowser 
                                    onAddAsset={(asset) => dispatch({ type: 'ADD_ASSET', payload: {...asset, isPublished: true} })}
                                    onAddAssetCollection={handleAddAssetCollection}
                                    onPreviewAsset={onPreviewAsset}
                                />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {gameData.assets.map(asset => (
                                    <div key={asset.id} className="bg-accent p-2 rounded-lg relative">
                                        <img src={asset.url} alt={asset.name} className="w-full h-32 object-cover rounded-md mb-2 cursor-pointer" onClick={() => onPreviewAsset(asset)} />
                                        <p className="text-sm truncate" title={asset.name}>{asset.name}</p>
                                        <p className="text-xs text-gray-400 capitalize">{asset.type.replace('Sprite', ' Sprite')}</p>
                                    </div>
                                ))}
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
                    {activeTab === 'players' && (
                         <div>
                            <h3 className="text-lg font-semibold text-highlight mb-2">Manage Players</h3>
                            <div className="space-y-2">
                            {players.map(player => (
                                <div key={player.id} className="flex items-center space-x-2 bg-accent p-2 rounded">
                                    <input type="text" value={player.name} onChange={e => handlePlayerUpdate(player.id, 'name', e.target.value)} className="p-2 bg-primary rounded-md flex-grow" placeholder="Player Name"/>
                                    <input type="number" value={player.coins || 0} onChange={e => handlePlayerUpdate(player.id, 'coins', parseInt(e.target.value) || 0)} className="w-24 p-2 bg-primary rounded-md" placeholder="Coins"/>
                                    <button onClick={() => removePlayer(player.id)} className="text-red-500 hover:text-red-400 p-2 rounded-full font-bold">X</button>
                                </div>
                            ))}
                            </div>
                            <button onClick={addPlayer} disabled={players.length >= MAX_PLAYERS} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-500">Add Player</button>
                        </div>
                    )}
                    {activeTab === 'approvals' && (
                        <div>
                            <h3 className="text-lg font-semibold text-highlight mb-2">Pending Asset Approvals ({approvals.length})</h3>
                             {approvals.length === 0 ? (
                                <p className="text-gray-400 italic">No assets waiting for approval.</p>
                             ) : (
                                <div className="space-y-3">
                                {approvals.map(approval => {
                                    const asset = gameData.assets.find(a => a.id === approval.assetId);
                                    const player = gameData.players.find(p => p.id === approval.submittingPlayerId);
                                    const character = gameData.characters.find(c => c.id === approval.characterIdToAssign);
                                    if (!asset) return null;
                                    return (
                                        <div key={asset.id} className="bg-accent p-3 rounded-lg flex items-center gap-4">
                                            <img src={asset.url} alt={asset.name} className="w-16 h-16 object-cover rounded-md cursor-pointer" onClick={() => onPreviewAsset(asset)} />
                                            <div className="flex-1">
                                                <p className="font-bold">{asset.name}</p>
                                                <p className="text-xs text-gray-300">
                                                    Submitted by: <span className="font-semibold">{player?.name || 'Unknown'}</span>
                                                </p>
                                                 <p className="text-xs text-gray-300">
                                                    For Character: <span className="font-semibold">{character?.name || 'Unknown'}</span>
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => dispatch({type: 'APPROVE_ASSET', payload: approval})} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-md text-sm">Approve</button>
                                                <button onClick={() => dispatch({type: 'REJECT_ASSET', payload: approval})} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md text-sm">Reject</button>
                                            </div>
                                        </div>
                                    )
                                })}
                                </div>
                             )}
                        </div>
                    )}
                    {activeTab === 'export' && (
                        <div>
                            <h3 className="text-lg font-semibold text-highlight mb-2">Game Export</h3>
                            <p className="mb-4 text-gray-400">This will render the entire game story into a video file and download it to your computer. This may take a few moments.</p>
                            
                            <div className="bg-accent p-4 rounded-lg mb-4 space-y-3">
                                <h4 className="font-bold text-lg">Video Settings</h4>
                                <div>
                                    <label htmlFor="video-quality" className="block text-sm font-medium text-gray-300">Video Quality</label>
                                    <select
                                        id="video-quality"
                                        value={videoQuality}
                                        onChange={e => setVideoQuality(e.target.value)}
                                        className="mt-1 w-full p-2 bg-primary rounded-md"
                                    >
                                        <option value="low">Low (Smaller file)</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High (Recommended)</option>
                                        <option value="ultra">Ultra (Highest quality)</option>
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">Higher quality results in a larger file size.</p>
                                </div>
                            </div>
                            
                            <div className="bg-accent p-4 rounded-lg mb-4 space-y-3">
                                <h4 className="font-bold text-lg">Timing Settings</h4>
                                <p className="text-sm text-gray-400">Control the pacing of the exported video.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="base-seconds" className="block text-sm font-medium text-gray-300">Base Seconds per Dialogue</label>
                                        <input
                                            type="number"
                                            id="base-seconds"
                                            value={timingBaseSeconds}
                                            onChange={e => setTimingBaseSeconds(parseFloat(e.target.value) || 0)}
                                            className="mt-1 w-full p-2 bg-primary rounded-md"
                                            step="0.1"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="seconds-per-word" className="block text-sm font-medium text-gray-300">Additional Seconds per Word</label>
                                        <input
                                            type="number"
                                            id="seconds-per-word"
                                            value={timingSecondsPerWord}
                                            onChange={e => setTimingSecondsPerWord(parseFloat(e.target.value) || 0)}
                                            className="mt-1 w-full p-2 bg-primary rounded-md"
                                            step="0.05"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <button onClick={handleExportVideo} disabled={isExporting} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md transition-colors disabled:bg-gray-600">
                                {isExporting ? `Exporting... ${Math.round(exportProgress)}%` : 'Export Game as Video'}
                            </button>
                             {isExporting && (
                                <div className="mt-4">
                                    <div className="w-full bg-accent rounded-full h-2.5">
                                        <div className="bg-purple-600 h-2.5 rounded-full" style={{width: `${exportProgress}%`}}></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            </div>
        </div>
    );
};

export default GMMenu;
