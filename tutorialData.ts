export interface TutorialStep {
    title: string;
    imageUrl: string;
    description: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: "The Setup Screen",
        imageUrl: "https://i.ibb.co/Fb8FKtJb/Screenshot-2025-08-24-013536.png",
        description: "Before the game begins, the host sets up the Game Rules, Players, Characters, and Assets. Online players will wait for the host to start the game."
    },
    {
        title: "The Game Screen",
        imageUrl: "https://i.ibb.co/RTrN8TBr/Screenshot-2025-08-24-014221.png",
        description: "The main screen shows the visuals on the left. On the right, you can toggle between the story History and the game Status (character stats, quests)."
    },
    {
        title: "Your Turn!",
        imageUrl: "https://i.ibb.co/4wh0bnDg/Screenshot-2025-08-24-014724.png",
        description: "When it's your turn, the controls appear at the bottom. Choose who to speak as, write dialogue, and change the scene. Click 'End Turn' when you're done."
    },
    {
        title: "Making Choices",
        imageUrl: "https://i.ibb.co/sp1QMHzX/Screenshot-2025-08-24-015036.png",
        description: "If the previous player left choices for you, you must select one to continue the story. Your turn will end automatically after choosing."
    },
    {
        title: "GM Actions",
        imageUrl: "https://i.ibb.co/m5fY9mST/Screenshot-2025-08-24-015303.png",
        description: "The host (GM) has access to a special menu to manage the game state, such as changing character stats, adding quests, managing players, and adding new assets on the fly."
    },
    {
        title: "Out-of-Character (OOC) Chat",
        imageUrl: "https://i.ibb.co/YCrzD5w/Screenshot-2025-08-24-015750.png",
        description: "Use the chat panel in the bottom-right to talk to other players out-of-character. A notification will appear for unread messages."
    }
];
