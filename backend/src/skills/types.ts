export interface SkillMetadata {
    name: string;
    description: string;
    license?: string;
    compatibility?: string;
    metadata?: Record<string, string>;
    [key: string]: any;
}

/**
 * Stage 1: 軽量メタデータ（起動時Discovery用）
 * ~100 tokens/skill
 */
export interface SkillSummary {
    name: string;
    description: string;
    path: string;
}

/**
 * Stage 2: アクティベート済みスキル（発動時読み込み）
 * SKILL.md本文を含む
 */
export interface ActivatedSkill extends SkillSummary {
    content: string;  // SKILL.md本文（フロントマター除く）
    metadata: SkillMetadata;
}

/**
 * Stage 3: 完全スキル（リソース含む）
 * scripts/, references/, assets/ を含む
 */
export interface FullSkill extends ActivatedSkill {
    scripts: Record<string, string>;
    references: Record<string, string>;
    assets: string[];
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
