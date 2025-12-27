import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './SkillDetailModal.module.css';
import { fetchSkillDetails } from '@/services/skills';
import { Skill } from '@/types/skills';

interface SkillDetailModalProps {
    skillName: string | null;
    onClose: () => void;
}

export default function SkillDetailModal({ skillName, onClose }: SkillDetailModalProps) {
    const [skill, setSkill] = useState<Skill | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!skillName) return;

        const loadSkill = async () => {
            setLoading(true);
            const data = await fetchSkillDetails(skillName);
            setSkill(data);
            setLoading(false);
        };
        loadSkill();
    }, [skillName]);

    if (!skillName) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>SKILL DATA: {skillName}</span>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loading}>DECRYPTING DATA...</div>
                    ) : skill ? (
                        <>
                            <div className={`${styles.markdown} markdown-content`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {skill.content}
                                </ReactMarkdown>
                            </div>

                            <div className={styles.metadataSection}>
                                <div>PATH: {skill.path}</div>
                                <div>ASSETS: {skill.assets?.length || 0}</div>
                                <div>SCRIPTS: {Object.keys(skill.scripts || {}).length}</div>
                            </div>
                        </>
                    ) : (
                        <div className={styles.loading}>ERROR: DATA CORRUPTED</div>
                    )}
                </div>
            </div>
        </div>
    );
}
