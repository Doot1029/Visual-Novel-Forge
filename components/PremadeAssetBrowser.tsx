import React, { useState } from 'react';
import { Asset, AssetType } from '../types';
import { PREMADE_BACKGROUNDS, PREMADE_SPRITE_COLLECTIONS, PREMADE_CG_COLLECTIONS, AssetCollection, PremadeAsset } from '../premadeData';

interface PremadeAssetBrowserProps {
  onAddAsset: (asset: Omit<Asset, 'id'>) => void;
  onAddAssetCollection: (assets: PremadeAsset[]) => void;
}

const PremadeAssetBrowser: React.FC<PremadeAssetBrowserProps> = ({ onAddAsset, onAddAssetCollection }) => {
  const [category, setCategory] = useState<'backgrounds' | 'characterSprites' | 'cgs'>('backgrounds');

  const renderContent = () => {
    switch (category) {
        case 'backgrounds':
            return (
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-1 bg-primary rounded">
                    {PREMADE_BACKGROUNDS.map(asset => (
                        <div key={asset.url} className="bg-secondary p-2 rounded-lg group relative">
                            <img src={asset.url} alt={asset.name} className="w-full h-24 object-cover rounded-md" />
                            <p className="text-xs mt-1 truncate">{asset.name}</p>
                            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onAddAsset({ ...asset, isPublished: true })}
                                className="px-3 py-1 bg-highlight text-white text-sm font-bold rounded-lg hover:bg-opacity-80"
                            >
                                Add
                            </button>
                            </div>
                        </div>
                    ))}
                </div>
            );
        case 'characterSprites':
        case 'cgs':
            const collections = category === 'characterSprites' ? PREMADE_SPRITE_COLLECTIONS : PREMADE_CG_COLLECTIONS;
            return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-1 bg-primary rounded">
                    {collections.map(collection => (
                         <div key={collection.name} className="bg-secondary p-2 rounded-lg group relative">
                            <img src={collection.assets[0].url} alt={collection.name} className="w-full h-24 object-cover rounded-md" />
                            <p className="text-xs mt-1 truncate">{collection.name} ({collection.assets.length} assets)</p>
                            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onAddAssetCollection(collection.assets)}
                                className="px-3 py-1 bg-highlight text-white text-sm font-bold rounded-lg hover:bg-opacity-80"
                            >
                                Add Collection
                            </button>
                            </div>
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
  }

  return (
    <div>
      <div className="flex border-b border-accent mb-2">
        <button onClick={() => setCategory('backgrounds')} className={`px-3 py-1 text-sm ${category === 'backgrounds' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Backgrounds</button>
        <button onClick={() => setCategory('characterSprites')} className={`px-3 py-1 text-sm ${category === 'characterSprites' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Sprite Collections</button>
        <button onClick={() => setCategory('cgs')} className={`px-3 py-1 text-sm ${category === 'cgs' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>CG Collections</button>
      </div>
      {renderContent()}
    </div>
  );
};

export default PremadeAssetBrowser;