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
    content: string; // Markdown content without frontmatter
    scripts: Record<string, string>; // filename -> content
    references: Record<string, string>; // filename -> content
    assets: string[]; // list of asset filenames
}

export interface SkillParserError extends Error {
    code: 'INVALID_FRONTMATTER' | 'MISSING_REQUIRED_FIELDS' | 'FILE_READ_ERROR';
}
