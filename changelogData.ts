
export interface ChangelogItem {
    type: 'feature' | 'fix' | 'improvement';
    description: string;
}

export interface ChangelogEntry {
    version: string;
    date: string;
    items: ChangelogItem[];
}

// Newest entries go on top.
export const changelogData: ChangelogEntry[] = [
    {
        version: "1.2.0",
        date: "August 26, 2024",
        items: [
            { type: 'feature', description: "Added this 'What's New' changelog window to keep you updated on the latest features and fixes!" },
        ],
    },
    {
        version: "1.1.0",
        date: "August 25, 2024",
        items: [
            { type: 'fix', description: "Fixed a critical loading issue where the app would get stuck on the 'Loading Application...' screen." },
            { type: 'fix', description: "Resolved a 'Could not fetch version.json' warning by using a more reliable relative path." },
            { type: 'improvement', description: "Added a global error handler to catch unexpected script errors and display a helpful debug message instead of crashing." },
            { type: 'fix', description: "Unmasked generic 'Script error' messages to allow for proper debugging of cross-origin script issues." },
        ],
    },
    {
        version: "1.0.1",
        date: "August 24, 2024",
        items: [
             { type: 'improvement', description: "Implemented an automatic version checker. The app now prompts you to refresh when a new version is deployed, fixing browser caching issues." },
            { type: 'fix', description: "Fixed a race condition that prevented players from rejoining a game if they tried too quickly after disconnecting." },
            { type: 'fix', description: "Restored the missing 'delete asset' button in the in-game GM Actions menu." },
        ],
    }
];

export const getLatestVersionFromChangelog = (): string => {
    return changelogData[0]?.version || "0.0.0";
};
