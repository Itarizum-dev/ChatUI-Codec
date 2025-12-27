import fs from 'fs/promises';
import path from 'path';
import { SkillManager } from './skillManager';

export class SkillCreator {
    private skillManager: SkillManager;

    constructor(skillManager: SkillManager) {
        this.skillManager = skillManager;
    }

    /**
     * 新しいスキルを初期化する
     */
    async initSkill(name: string): Promise<{ path: string; name: string }> {
        // 名前のバリデーション
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) {
            throw new Error('Invalid skill name. Must use only lowercase alphanumeric characters and hyphens.');
        }

        const skillsDir = this.skillManager.getSkillsDirectory();
        const skillPath = path.join(skillsDir, name);

        // ディレクトリが既に存在するか確認
        try {
            await fs.access(skillPath);
            throw new Error(`Skill directory already exists: ${skillPath}`);
        } catch (e: any) {
            if (e.code !== 'ENOENT') throw e;
        }

        // ディレクトリ作成
        await fs.mkdir(skillPath, { recursive: true });
        await fs.mkdir(path.join(skillPath, 'scripts'));
        await fs.mkdir(path.join(skillPath, 'references'));
        await fs.mkdir(path.join(skillPath, 'assets'));

        // SKILL.mdテンプレート作成
        const skillMdContent = `---
name: ${name}
description: "TODO: Describe what this skill does and when to use it using specific keywords."
---

# ${name}

## Guidelines
- TODO: Add guidelines strictly for the model to follow

## Instructions
1. TODO: Add step-by-step instructions
`;
        await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillMdContent);

        // サンプルファイル作成
        await fs.writeFile(path.join(skillPath, 'scripts', 'example.py'), '# Example script\nprint("Hello from skill!")\n');
        await fs.writeFile(path.join(skillPath, 'references', 'example.md'), '# Example Reference\nThis is a reference file.\n');

        return { path: skillPath, name };
    }

    /**
     * スキルを検証する
     */
    async validateSkill(name: string): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        try {
            // キャッシュを無視して強制リロードし、詳細エラーを取得
            const skill = await this.skillManager.loadSkillWithError(name);

            // 追加のバリデーションルールをここに実装可能
            if (skill.name !== name) {
                errors.push(`Skill name in SKILL.md ("${skill.name}") does not match directory name ("${name}").`);
            }

            // 必須フィールドの簡易チェックはパーサーで行われているが、より詳細なチェックをここで行う

        } catch (e: any) {
            errors.push(e.message);
        }

        return { valid: errors.length === 0, errors };
    }
}
