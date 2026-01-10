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
    async initSkill(name: string, description: string): Promise<{ path: string; name: string }> {
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

        // SKILL.mdテンプレート作成 (Agent Skills互換)
        const skillTitle = name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        const skillMdContent = `---
name: ${name}
description: "${description}"
version: "1.0.0"
---

# ${skillTitle}

${description}

## When to use this skill
- TODO: Add specific trigger conditions
- Example: "When the user asks to..."

## Instructions
1. TODO: Add step-by-step instructions
2. Step 2

## Tools Required
- TODO: List required tools (e.g., web_search, file_system)

## References
- \`references/example.md\`: Description of the reference file
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
            // Stage 2: activateSkillでSKILL.md本文を読み込み検証
            const skill = await this.skillManager.activateSkill(name);

            if (!skill) {
                errors.push(`Skill "${name}" not found or failed to load.`);
                return { valid: false, errors };
            }

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
