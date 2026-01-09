import { getBackendUrl } from '@/config/providers';
import { Skill } from '@/types/skills';

/**
 * 利用資格のあるスキル一覧を取得
 */
export async function fetchSkills(): Promise<Array<{ name: string; description: string }>> {
    try {
        const response = await fetch(`${getBackendUrl()}/api/skills`);
        if (!response.ok) {
            throw new Error(`Failed to fetch skills: ${response.statusText}`);
        }
        const data = await response.json();
        return data.skills;
    } catch (error) {
        console.error('Error fetching skills:', error);
        return [];
    }
}

/**
 * スキルの詳細を取得
 */
export async function fetchSkillDetails(name: string): Promise<Skill | null> {
    try {
        const response = await fetch(`${getBackendUrl()}/api/skills/${name}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch skill details: ${response.statusText}`);
        }
        const data = await response.json();
        return data.skill;
    } catch (error) {
        console.error(`Error fetching skill details for ${name}:`, error);
        return null;
    }
}

/**
 * 新規スキルのテンプレート作成 (Skill Creator)
 */
export async function initSkill(name: string): Promise<{ path: string; name: string } | null> {
    try {
        const response = await fetch(`${getBackendUrl()}/api/skills/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to init skill: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error initializing skill:', error);
        throw error;
    }
}
