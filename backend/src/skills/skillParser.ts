import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { Skill, SkillMetadata, SkillParserError, SkillSummary, ActivatedSkill } from './types';

export class SkillParser {
    /**
     * [Stage 1] フロントマター（name, description）のみを抽出
     * 起動時Discovery用の軽量読み込み（~100 tokens/skill）
     */
    async loadMetadataOnly(skillPath: string): Promise<SkillSummary> {
        const skillFile = path.join(skillPath, 'SKILL.md');
        console.log(`[Skills:Stage1] Loading metadata only from: ${path.basename(skillPath)}`);

        const fileContent = await fs.readFile(skillFile, 'utf8');

        // フロントマター部分のみ抽出（本文全体は読み込まない）
        const frontmatterMatch = fileContent.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
        if (!frontmatterMatch) {
            throw new Error(`Invalid SKILL.md format at ${skillPath}: Missing YAML frontmatter`);
        }

        const metadata = yaml.parse(frontmatterMatch[1]) as SkillMetadata;
        this.validateMetadata(metadata);

        console.log(`[Skills:Stage1] ✓ Discovered: ${metadata.name} (${metadata.description.slice(0, 50)}...)`);

        return {
            name: metadata.name,
            description: metadata.description,
            path: skillPath
        };
    }

    /**
     * [Stage 2] スキル発動時: SKILL.md本文を読み込む
     * フロントマター + 本文（リソースは除く）
     */
    async loadActivatedSkill(skillPath: string): Promise<ActivatedSkill> {
        const skillFile = path.join(skillPath, 'SKILL.md');
        console.log(`[Skills:Stage2] Activating skill: ${path.basename(skillPath)}`);

        const fileContent = await fs.readFile(skillFile, 'utf8');
        const { metadata, content } = this.parseSkillFile(fileContent);
        this.validateMetadata(metadata);

        console.log(`[Skills:Stage2] ✓ Activated: ${metadata.name} (content: ${content.length} chars)`);

        return {
            name: metadata.name,
            description: metadata.description,
            path: skillPath,
            content,
            metadata
        };
    }

    /**
     * [Stage 3] 完全スキル読み込み: リソース含む
     * @deprecated 段階的読み込みではloadMetadataOnly + loadActivatedSkill + loadResourceを推奨
     */
    async loadSkill(skillPath: string): Promise<Skill> {
        console.log(`[Skills:Stage3] Loading full skill with resources: ${path.basename(skillPath)}`);
        try {
            const skillFile = path.join(skillPath, 'SKILL.md');
            const fileContent = await fs.readFile(skillFile, 'utf8');

            // FrontmatterとContentを分離
            const { metadata, content } = this.parseSkillFile(fileContent);

            // バリデーション
            this.validateMetadata(metadata);

            // スキル名とディレクトリ名が一致するか確認（仕様推奨）
            const dirName = path.basename(skillPath);
            if (metadata.name !== dirName) {
                console.warn(`Warning: Skill name "${metadata.name}" does not match directory name "${dirName}"`);
            }

            // 関連リソースの読み込み
            const scripts = await this.loadDirectoryContents(path.join(skillPath, 'scripts'));
            const references = await this.loadDirectoryContents(path.join(skillPath, 'references'));
            const assets = await this.listDirectoryFiles(path.join(skillPath, 'assets'));

            console.log(`[Skills:Stage3] ✓ Full load complete: ${metadata.name}`);

            return {
                name: metadata.name,
                path: skillPath,
                metadata,
                content,
                scripts,
                references,
                assets
            };
        } catch (error: any) {
            throw new Error(`Failed to load skill at ${skillPath}: ${error.message}`);
        }
    }

    /**
     * SKILL.mdの内容をパースする
     */
    private parseSkillFile(fileContent: string): { metadata: SkillMetadata; content: string } {
        // 正規表現を緩和: 改行コード(CRLF/LF)に対応し、前後の空白をトリム
        const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
        const match = fileContent.match(frontmatterRegex);

        if (!match) {
            throw new Error('Invalid SKILL.md format: Missing YAML frontmatter');
        }

        try {
            const metadata = yaml.parse(match[1]) as SkillMetadata;
            const content = match[2];
            return { metadata, content };
        } catch (e: any) {
            throw new Error(`Failed to parse YAML frontmatter: ${e.message}`);
        }
    }

    /**
     * メタデータのバリデーション
     */
    private validateMetadata(metadata: SkillMetadata): void {
        if (!metadata.name) {
            throw new Error('Missing required field: name');
        }
        if (!metadata.description) {
            throw new Error('Missing required field: description');
        }

        // 名前のバリデーション: 小文字英数字とハイフンのみ、開始終了ハイフン禁止、連続ハイフン禁止
        const nameRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
        if (!nameRegex.test(metadata.name)) {
            throw new Error(`Invalid skill name "${metadata.name}". Must contain only lowercase alphanumeric characters and hyphens.`);
        }
        if (metadata.name.includes('--')) {
            throw new Error(`Invalid skill name "${metadata.name}". Cannot contain consecutive hyphens.`);
        }
    }

    /**
     * ディレクトリ内のファイル内容を読み込む
     */
    private async loadDirectoryContents(dirPath: string): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        try {
            const files = await fs.readdir(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    result[file] = await fs.readFile(filePath, 'utf8');
                }
            }
        } catch (e) {
            // ディレクトリが存在しない場合は無視
            return {};
        }
        return result;
    }

    /**
     * ディレクトリ内のファイルリストを取得
     */
    private async listDirectoryFiles(dirPath: string): Promise<string[]> {
        try {
            const files = await fs.readdir(dirPath);
            const result: string[] = [];
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    result.push(file);
                }
            }
            return result;
        } catch (e) {
            // ディレクトリが存在しない場合は無視
            return [];
        }
    }
}
