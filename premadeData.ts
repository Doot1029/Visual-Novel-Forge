import { AssetType, Asset } from "./types";

export const PREMADE_BIOS: Record<string, string[]> = {
  "Fantasy": [
    "A disgraced knight on a quest to restore their family's honor.",
    "A powerful mage who has lost their memory and is relearning their abilities.",
    "A cheerful baker with a mysterious past and an uncanny knowledge of ancient runes.",
    "A hardened mercenary who only cares about money, until they find a cause worth fighting for.",
    "A sky-pirate captain who values freedom above all else, constantly on the run from a tyrannical empire.",
  ],
  "Sci-Fi": [
    "A grizzled starship pilot haunted by a past smuggling run that went horribly wrong.",
    "An android struggling with newfound emotions and its place in a society that sees it as a machine.",
    "A brilliant cyberneticist who is on the run after discovering their employer's unethical experiments.",
    "A veteran soldier from an intergalactic war trying to adapt to a peaceful life on a backwater planet.",
  ],
  "Modern Mystery": [
    "A cynical detective who has seen too much but can't quit the job.",
    "An ambitious scholar obsessed with uncovering a forbidden historical secret.",
    "A diplomat from a far-off land struggling to navigate the complex politics of a new city.",
    "A street urchin with a hidden talent for observation that could change the fate of the investigation.",
  ],
};


export type PremadeAsset = Omit<Asset, 'id' | 'isPublished'>;

export interface AssetCollection {
  name: string;
  assets: PremadeAsset[];
}

export const PREMADE_BACKGROUNDS: PremadeAsset[] = [
    { name: "Kitchen 1", url: "https://i.ibb.co/tPsPHz86/Kitchen-2-Day.png", type: "background" as const },
    { name: "Backyard 2", url: "https://i.ibb.co/n80Yr5bm/Backyard-2-Day.png", type: "background" as const },
    { name: "Backyard 1", url: "https://i.ibb.co/cXYt5QS5/Backyard-1-Day.png", type: "background" as const },
    { name: "Kitchen 2", url: "https://i.ibb.co/0Vv0SF4v/Kitchen-1-Night-Light.png", type: "background" as const },
    { name: "Kitchen 2 (Day)", url: "https://i.ibb.co/KpPbxS2z/Kitchen-1-Day.png", type: "background" as const },
    { name: "House", url: "https://i.ibb.co/LhRS2Kh3/House-3-Day.png", type: "background" as const },
    { name: "Girl Bedroom (Night)", url: "https://i.ibb.co/psWM7Yk/Female-Bedroom-2-Night-Light.png", type: "background" as const },
    { name: "Girl Bedroom (Day)", url: "https://i.ibb.co/XfXDPX6x/Female-Bedroom-2-Day.png", type: "background" as const },
    { name: "Dining Room", url: "https://i.ibb.co/SX4chxwH/Dining-Room-2-Day.png", type: "background" as const },
    { name: "Backyard 3", url: "https://i.ibb.co/xtSBPjgW/Backyard-3-Day.png", type: "background" as const },
    { name: "Boy Bedroom (Day)", url: "https://i.ibb.co/QvFwXm1R/Male-Bedroom-3-Day.png", type: "background" as const },
    { name: "Boy Bedroom (Night)", url: "https://i.ibb.co/TqJgZF6x/Male-Bedroom-3-Night-Light.png", type: "background" as const },
    { name: "Bedroom (Night)", url: "https://i.ibb.co/Kpx4GYhM/Male-Bedroom-1-Night-Light.png", type: "background" as const },
    { name: "Bedroom (Day)", url: "https://i.ibb.co/SX7qNz5T/Male-Bedroom-1-Day.png", type: "background" as const },
    { name: "", url: "", type: "background" as const },
    { name: "", url: "", type: "background" as const },
    { name: "", url: "", type: "background" as const },
    { name: "", url: "", type: "background" as const },
    { name: "", url: "", type: "background" as const },
    { name: "", url: "", type: "background" as const },
    { name: "", url: "", type: "background" as const },
    { name: "", url: "", type: "background" as const },
];

export const PREMADE_SPRITE_COLLECTIONS: AssetCollection[] = [
  {
    name: "Mannequin Character 1 Pack",
    assets: [
      { name: "Amy", url: "https://i.ibb.co/bR8ZcvHF/Amy.png", type: "characterSprite" as const },
    ]
  },
];

export const PREMADE_CG_COLLECTIONS: AssetCollection[] = [
    {
        name: "Action Scenes",
        assets: [
            { name: "Epic Battle", url: "https://loremflickr.com/1280/720/fantasy,battle?lock=11", type: "cg" as const },
            { name: "Explosion", url: "https://loremflickr.com/1280/720/explosion?lock=12", type: "cg" as const },
        ]
    },
    {
        name: "Atmospheric Scenes",
        assets: [
            { name: "Quiet Discovery", url: "https://loremflickr.com/1280/720/discovery,ancient?lock=13", type: "cg" as const },
        ]
    }
];