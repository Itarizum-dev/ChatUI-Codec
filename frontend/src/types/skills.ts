export interface SkillMetadata {
    name: string;
    description: string;
    license?: string;
    compatibility?: string;
    metadata?: Record<string, string>;
    [key: string]: any;
}

export interface Skill {
    name: string;
    path: string;
    metadata: SkillMetadata;
    content: string;
    scripts: Record<string, string>;
    references: Record<string, string>;
    assets: string[];
}
