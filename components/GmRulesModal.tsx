import React from 'react';

interface GmRulesModalProps {
    rules: string;
    onClose: () => void;
}

const GmRulesModal: React.FC<GmRulesModalProps> = ({ rules, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-primary bg-opacity-90 z-50 flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
        >
            <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-lg flex flex-col relative border-2 border-accent">
                <div className="flex justify-between items-center p-4 border-b border-accent">
                    <h2 className="text-2xl font-bold text-highlight">Game Master's Rules</h2>
                    <button onClick={onClose} className="text-light hover:text-highlight text-3xl font-bold" aria-label="Close Rules">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="text-light whitespace-pre-wrap">{rules}</div>
                </div>
                <div className="p-4 border-t border-accent text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80">
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GmRulesModal;
