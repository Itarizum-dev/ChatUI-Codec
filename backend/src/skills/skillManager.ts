import fs from 'fs/promises';
import path from 'path';
import { Skill } from './types';
import { SkillParser } from './skillParser';

export class SkillManager {
    private skillsDir: string;
    private parser: SkillParser;
    private skillsCache: Map<string, Skill> = new Map();

    constructor(skillsDir?: string) {
        // デフォルトは backend/skills
        this.skillsDir = skillsDir || path.resolve(__dirname, '../../skills');
        this.parser = new SkillParser();
    }

    /**
     * 初期化処理（全スキルロード）
     */
    async initialize(): Promise<void> {
        await this.loadAllSkills();
    }

    /**
     * 全てのスキルをロードする
     */
    async loadAllSkills(): Promise<Skill[]> {
        this.skillsCache.clear();
        try {
            await fs.access(this.skillsDir);
        } catch {
            console.warn(`Skills directory not found: ${this.skillsDir}`);
            return [];
        }

        const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
        const skills: Skill[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                try {
                    const skill = await this.parser.loadSkill(path.join(this.skillsDir, entry.name));
                    this.skillsCache.set(skill.name, skill);
                    skills.push(skill);
                } catch (e: any) {
                    console.error(`Failed to load skill "${entry.name}":`, e.message);
                }
            }
        }

        return skills;
    }

    /**
     * 特定のスキルを取得
     */
    async getSkill(name: string): Promise<Skill | undefined> {
        if (this.skillsCache.has(name)) {
            return this.skillsCache.get(name);
        }

        // キャッシュにない場合はリロードを試みる
        try {
            const skillPath = path.join(this.skillsDir, name);
            const skill = await this.parser.loadSkill(skillPath);
            this.skillsCache.set(name, skill);
            return skill;
        } catch (e: any) {
            console.error(`Failed to load skill "${name}":`, e.message);
            return undefined;
        }
    }

    /**
     * 特定のスキルを取得（エラー時はスロー）
     */
    async loadSkillWithError(name: string): Promise<Skill> {
        const skillPath = path.join(this.skillsDir, name);
        try {
            const skill = await this.parser.loadSkill(skillPath);
            this.skillsCache.set(name, skill);
            return skill;
        } catch (e: any) {
            throw new Error(`Failed to load skill "${name}": ${e.message}`);
        }
    }

    /**
     * 利用可能なスキルのメタデータリストを取得（Discovery用）
     */
    async getAvailableSkills(): Promise<Array<{ name: string; description: string; path: string }>> {
        const skills = await this.loadAllSkills();
        return skills.map(s => ({
            name: s.name,
            description: s.metadata.description,
            path: s.path
        }));
    }

    /**
     * スキルディレクトリへのパスを取得
     */
    getSkillsDirectory(): string {
        return this.skillsDir;
    }
}
