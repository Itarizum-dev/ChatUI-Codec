import { useEffect, useState } from 'react';
import styles from './SkillList.module.css';
import { fetchSkills } from '@/services/skills';

interface SkillSummary {
    name: string;
    description: string;
}

interface SkillListProps {
    onSelectSkill: (name: string) => void;
}

export default function SkillList({ onSelectSkill }: SkillListProps) {
    const [skills, setSkills] = useState<SkillSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSkills = async () => {
            setLoading(true);
            const data = await fetchSkills();
            setSkills(data);
            setLoading(false);
        };
        loadSkills();
    }, []);

    if (loading) {
        return <div className={styles.loading}>SCANNING...</div>;
    }

    if (skills.length === 0) {
        return <div className={styles.empty}>NO SKILLS DETECTED</div>;
    }

    return (
        <div className={styles.container}>
            {skills.map((skill) => (
                <div
                    key={skill.name}
                    className={styles.skillItem}
                    onClick={() => onSelectSkill(skill.name)}
                >
                    <div className={styles.skillIcon}>
                        S
                    </div>
                    <div className={styles.skillInfo}>
                        <div className={styles.skillName}>{skill.name}</div>
                        <div className={styles.skillDescription}>{skill.description}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
