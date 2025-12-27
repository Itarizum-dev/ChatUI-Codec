import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { Skill, SkillMetadata, SkillParserError } from './types';

export class SkillParser {
    /**
     * Skillディレクトリからスキルを読み込む
     */
    async loadSkill(skillPath: string): Promise<Skill> {
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
