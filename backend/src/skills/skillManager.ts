import fs from 'fs/promises';
import path from 'path';
import { SkillSummary, ActivatedSkill } from './types';
import { SkillParser } from './skillParser';

export class SkillManager {
    private skillsDir: string;
    private parser: SkillParser;

    // Stage 1: メタデータキャッシュ（起動時Discovery用）
    private metadataCache: Map<string, SkillSummary> = new Map();

    // Stage 2: アクティベート済みスキルキャッシュ（発動時）
    private activatedCache: Map<string, ActivatedSkill> = new Map();

    constructor(skillsDir?: string) {
        // デフォルトは backend/skills
        this.skillsDir = skillsDir || path.resolve(__dirname, '../../skills');
        this.parser = new SkillParser();
        console.log(`[SkillManager] Initialized with skills directory: ${this.skillsDir}`);
    }

    /**
     * 初期化処理（メタデータのみ読み込み - Stage 1）
     */
    async initialize(): Promise<void> {
        console.log('[SkillManager] ===== Initializing (Stage 1: Discovery) =====');
        await this.discoverSkills();
        console.log(`[SkillManager] ===== Discovery complete: ${this.metadataCache.size} skills found =====`);
    }

    // ============================================
    // Stage 1: Discovery（起動時メタデータ読み込み）
    // ============================================

    /**
     * [Stage 1] 全スキルのメタデータを発見・読み込み
     * 起動時に呼び出される軽量読み込み（~100 tokens/skill）
     */
    async discoverSkills(): Promise<SkillSummary[]> {
        this.metadataCache.clear();

        try {
            await fs.access(this.skillsDir);
        } catch {
            console.warn(`[SkillManager:Stage1] Skills directory not found: ${this.skillsDir}`);
            return [];
        }

        const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
        const summaries: SkillSummary[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                try {
                    const summary = await this.parser.loadMetadataOnly(
                        path.join(this.skillsDir, entry.name)
                    );
                    this.metadataCache.set(summary.name, summary);
                    summaries.push(summary);
                } catch (e: any) {
                    console.error(`[SkillManager:Stage1] Failed to discover skill "${entry.name}":`, e.message);
                }
            }
        }

        return summaries;
    }

    /**
     * [Stage 1] 利用可能なスキルのメタデータリストを取得
     * キャッシュから返す（再読み込みなし）
     */
    async getAvailableSkills(): Promise<SkillSummary[]> {
        // キャッシュが空なら再発見
        if (this.metadataCache.size === 0) {
            return await this.discoverSkills();
        }
        return Array.from(this.metadataCache.values());
    }

    // ============================================
    // Stage 2: Activation（スキル発動時の本文読み込み）
    // ============================================

    /**
     * [Stage 2] スキルをアクティベート（SKILL.md本文を読み込み）
     * タスクがスキルにマッチした時に呼び出される
     */
    async activateSkill(name: string): Promise<ActivatedSkill | undefined> {
        // 既にアクティベート済みならキャッシュから返す
        if (this.activatedCache.has(name)) {
            console.log(`[SkillManager:Stage2] Returning cached activated skill: ${name}`);
            return this.activatedCache.get(name);
        }

        const skillPath = path.join(this.skillsDir, name);
        try {
            const activated = await this.parser.loadActivatedSkill(skillPath);
            this.activatedCache.set(name, activated);
            return activated;
        } catch (e: any) {
            console.error(`[SkillManager:Stage2] Failed to activate skill "${name}":`, e.message);
            return undefined;
        }
    }

    // ============================================
    // Stage 3: Resource Loading（リソース読み込み）
    // ============================================

    /**
     * [Stage 3] スキルのリソースを読み込む
     * scripts/, references/, assets/ 内のファイルをオンデマンドで読み込む
     */
    async loadSkillResource(skillName: string, resourcePath: string): Promise<string | undefined> {
        const fullPath = path.join(this.skillsDir, skillName, resourcePath);
        console.log(`[SkillManager:Stage3] Loading resource: ${skillName}/${resourcePath}`);

        try {
            const content = await fs.readFile(fullPath, 'utf8');
            console.log(`[SkillManager:Stage3] ✓ Resource loaded: ${content.length} chars`);
            return content;
        } catch (e: any) {
            console.error(`[SkillManager:Stage3] Failed to load resource "${resourcePath}":`, e.message);
            return undefined;
        }
    }

    /**
     * スキルディレクトリへのパスを取得
     */
    getSkillsDirectory(): string {
        return this.skillsDir;
    }
}
