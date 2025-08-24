export const PREMADE_PROMPTS: Record<string, string[]> = {
  "Fantasy": [
    "A traveling merchant caravan must navigate a dangerous, monster-infested trade route while protecting a secret cargo.",
    "In a magical academy, a group of students uncovers a conspiracy that threatens their entire world.",
    "The last heir of a fallen kingdom, secretly living in exile, is discovered and must reclaim their throne.",
  ],
  "Sci-Fi": [
    "A cyberpunk detective investigates a series of bizarre memory thefts in a rain-slicked metropolis.",
    "A crew of space explorers crash-lands on an uncharted planet teeming with strange flora and fauna.",
    "Survivors in a post-apocalyptic world discover a hidden sanctuary that may be too good to be true.",
  ],
  "Modern Mystery": [
    "A group of strangers are invited to a remote island mansion for a weekend, only to find themselves trapped as a storm rolls in and a murder occurs.",
    "An investigative journalist receives an anonymous tip about a massive corporate cover-up and must expose the truth before they are silenced.",
  ],
};

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

// This is the new library of curated assets.
export const PREMADE_ASSETS = {
  backgrounds: [
    { name: "Fantasy Castle", url: "https://loremflickr.com/1280/720/fantasy,castle?lock=1", type: "background" as const },
    { name: "Enchanted Forest", url: "https://loremflickr.com/1280/720/fantasy,forest?lock=2", type: "background" as const },
    { name: "Sci-Fi Megacity", url: "https://loremflickr.com/1280/720/cyberpunk,city?lock=3", type: "background" as const },
    { name: "Spaceship Bridge", url: "https://loremflickr.com/1280/720/spaceship,bridge?lock=4", type: "background" as const },
    { name: "Modern Library", url: "https://loremflickr.com/1280/720/library?lock=5", type: "background" as const },
    { name: "Desert Ruins", url: "https://loremflickr.com/1280/720/ruins,desert?lock=6", type: "background" as const },
  ],
  characterSprites: [
    { name: "Amy", url: "https://i.ibb.co/bR8ZcvHF/Amy.png", type: "characterSprite" as const },
    { name: "Male Mage", url: "https://loremflickr.com/768/1024/anime,male,mage?lock=8", type: "characterSprite" as const },
    { name: "Cyberpunk Hacker", url: "https://loremflickr.com/768/1024/anime,cyberpunk,hacker?lock=9", type: "characterSprite" as const },
    { name: "Android Agent", url: "https://loremflickr.com/768/1024/anime,android,cyborg?lock=10", type: "characterSprite" as const },
  ],
  cgs: [
    { name: "Epic Battle", url: "https://loremflickr.com/1280/720/fantasy,battle?lock=11", type: "cg" as const },
    { name: "Explosion", url: "https://loremflickr.com/1280/720/explosion?lock=12", type: "cg" as const },
    { name: "Quiet Discovery", url: "https://loremflickr.com/1280/720/discovery,ancient?lock=13", type: "cg" as const },
  ],
};