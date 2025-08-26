
import React from 'react';
import { changelogData } from '../changelogData';

interface ChangelogModalProps {
    onClose: () => void;
    currentDisplayVersion: string;
}

const typeStyles = {
    feature: 'bg-blue-500 text-blue-100',
    fix: 'bg-red-500 text-red-100',
    improvement: 'bg-green-500 text-green-100',
};

const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose, currentDisplayVersion }) => {
    return (
        <div 
            className="fixed inset-0 bg-primary bg-opacity-95 z-[150] flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="bg-secondary rounded-lg shadow-2xl w-full max-w-2xl flex flex-col relative border-2 border-accent h-[80vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-accent">
                    <h2 className="text-2xl font-bold text-highlight">What's New in Version {currentDisplayVersion}</h2>
                    <button onClick={onClose} className="text-light hover:text-highlight text-3xl font-bold" aria-label="Close Changelog">&times;</button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {changelogData.map((entry) => (
                        <div key={entry.version}>
                            <h3 className="text-xl font-semibold text-light border-b border-accent pb-1 mb-2">
                                Version {entry.version} <span className="text-sm text-gray-400 font-normal">- {entry.date}</span>
                            </h3>
                            <ul className="space-y-2 list-none p-0">
                                {entry.items.map((item, index) => (
                                    <li key={index} className="flex items-start gap-3">
                                        <span className={`flex-shrink-0 mt-1 capitalize text-xs font-bold px-2 py-0.5 rounded-full ${typeStyles[item.type]}`}>
                                            {item.type}
                                        </span>
                                        <p className="text-light m-0">{item.description}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-accent text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChangelogModal;
