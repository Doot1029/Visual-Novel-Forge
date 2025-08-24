import React, { useState } from 'react';
import { TUTORIAL_STEPS } from '../tutorialData';

interface TutorialModalProps {
    onClose: () => void;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };
    
    const { imageUrl, description, title } = TUTORIAL_STEPS[currentStep];

    return (
        <div 
            className="fixed inset-0 bg-primary bg-opacity-90 z-50 flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
        >
            <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-3xl flex flex-col relative border-2 border-accent">
                <div className="flex justify-between items-center p-4 border-b border-accent">
                    <h2 className="text-2xl font-bold text-highlight">Game Tutorial</h2>
                    <button onClick={onClose} className="text-light hover:text-highlight text-3xl font-bold" aria-label="Close Tutorial">&times;</button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <h3 className="text-xl font-semibold mb-4 text-center">{title}</h3>
                    <div className="relative aspect-video bg-primary rounded-lg mb-4">
                        <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
                    </div>
                    <p className="text-light text-center min-h-[4rem]">{description}</p>
                </div>
                <div className="p-4 border-t border-accent flex justify-between items-center">
                     <button 
                        onClick={handlePrev} 
                        disabled={currentStep === 0}
                        className="px-6 py-2 bg-accent text-white font-bold rounded-lg hover:bg-opacity-80 disabled:bg-gray-600 disabled:cursor-not-allowed"
                     >
                        &larr; Prev
                    </button>
                    <span className="font-mono">{currentStep + 1} / {TUTORIAL_STEPS.length}</span>
                     <button 
                        onClick={handleNext} 
                        disabled={currentStep === TUTORIAL_STEPS.length - 1}
                        className="px-6 py-2 bg-accent text-white font-bold rounded-lg hover:bg-opacity-80 disabled:bg-gray-600 disabled:cursor-not-allowed"
                     >
                        Next &rarr;
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TutorialModal;
