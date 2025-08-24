import React, { useState } from 'react';
import { AssetType } from '../types';
import { PREMADE_ASSETS } from '../premadeData';

interface PremadeAssetBrowserProps {
  onAddAsset: (asset: { name: string; url: string; type: AssetType, isPublished: boolean }) => void;
}

const PremadeAssetBrowser: React.FC<PremadeAssetBrowserProps> = ({ onAddAsset }) => {
  const [category, setCategory] = useState<'backgrounds' | 'characterSprites' | 'cgs'>('backgrounds');
  
  const assetsToShow = PREMADE_ASSETS[category];

  return (
    <div>
      <div className="flex border-b border-accent mb-2">
        <button onClick={() => setCategory('backgrounds')} className={`px-3 py-1 text-sm ${category === 'backgrounds' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Backgrounds</button>
        <button onClick={() => setCategory('characterSprites')} className={`px-3 py-1 text-sm ${category === 'characterSprites' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>Sprites</button>
        <button onClick={() => setCategory('cgs')} className={`px-3 py-1 text-sm ${category === 'cgs' ? 'text-highlight border-b-2 border-highlight' : 'text-light'}`}>CGs</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-1 bg-primary rounded">
        {assetsToShow.map(asset => (
          <div key={asset.url} className="bg-secondary p-2 rounded-lg group relative">
            {asset.type === 'music' ? (
              <div className="w-full h-24 bg-primary rounded-md flex items-center justify-center text-light text-4xl">🎵</div>
            ) : (
              <img src={asset.url} alt={asset.name} className="w-full h-24 object-cover rounded-md" />
            )}
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
    </div>
  );
};

export default PremadeAssetBrowser;