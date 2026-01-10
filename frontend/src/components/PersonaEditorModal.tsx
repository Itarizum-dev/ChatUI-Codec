/**
 * PersonaEditorModal Component
 * ペルソナの追加・編集・削除を行うUI
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './PersonaEditorModal.module.css';
import { Persona } from '@/types';
import { processImageFile } from '@/hooks/usePersonas';

interface PersonaEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    personas: Persona[];
    onAdd: (persona: Omit<Persona, 'id' | 'isBuiltIn'>) => void;
    onUpdate: (id: string, updates: Partial<Persona>) => void;
    onDelete: (id: string) => boolean;
    onResetBuiltinPrompt: (id: string) => void;
}

export default function PersonaEditorModal({
    isOpen,
    onClose,
    personas,
    onAdd,
    onUpdate,
    onDelete,
    onResetBuiltinPrompt,
}: PersonaEditorModalProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Add form state
    const [newName, setNewName] = useState('');
    const [newCodename, setNewCodename] = useState('');
    const [newFrequency, setNewFrequency] = useState('');
    const [newSystemPrompt, setNewSystemPrompt] = useState('');
    const [newPortraitData, setNewPortraitData] = useState<string | null>(null);

    // Edit form state
    const [editSystemPrompt, setEditSystemPrompt] = useState('');
    const [editPortraitData, setEditPortraitData] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editCodename, setEditCodename] = useState('');
    const [editFrequency, setEditFrequency] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const resetAddForm = () => {
        setNewName('');
        setNewCodename('');
        setNewFrequency('');
        setNewSystemPrompt('');
        setNewPortraitData(null);
        setShowAddForm(false);
        setError(null);
    };

    const handleImageUpload = async (file: File, isEdit: boolean = false) => {
        try {
            setError(null);
            const base64 = await processImageFile(file);
            if (isEdit) {
                setEditPortraitData(base64);
            } else {
                setNewPortraitData(base64);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to process image');
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent, isEdit: boolean = false) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageUpload(e.dataTransfer.files[0], isEdit);
        }
    };

    const handleAddSubmit = () => {
        if (!newCodename.trim()) {
            setError('Codename is required');
            return;
        }

        onAdd({
            name: newName.trim() || newCodename.trim(),
            codename: newCodename.trim().toUpperCase(),
            frequency: newFrequency.trim() || '142.00',
            systemPrompt: newSystemPrompt.trim(),
            portraitData: newPortraitData || undefined,
        });

        resetAddForm();
    };

    const startEditing = (persona: Persona) => {
        setEditingId(persona.id);
        setEditSystemPrompt(persona.systemPrompt);
        setEditPortraitData(persona.portraitData || null);
        setEditName(persona.name);
        setEditCodename(persona.codename);
        setEditFrequency(persona.frequency);
        setError(null);
    };

    const handleEditSubmit = (persona: Persona) => {
        if (persona.isBuiltIn) {
            // Only update system prompt for builtins
            onUpdate(persona.id, { systemPrompt: editSystemPrompt });
        } else {
            // Update all fields for custom personas
            onUpdate(persona.id, {
                name: editName.trim() || editCodename.trim(),
                codename: editCodename.trim().toUpperCase(),
                frequency: editFrequency.trim() || '142.00',
                systemPrompt: editSystemPrompt,
                portraitData: editPortraitData || undefined,
            });
        }
        setEditingId(null);
    };

    const handleDelete = (persona: Persona) => {
        if (persona.isBuiltIn) return;
        if (!confirm(`Delete "${persona.codename}"?`)) return;
        onDelete(persona.id);
    };

    const [copied, setCopied] = useState(false);

    const handleCopyPrompt = () => {
        const prompt = "anime style character portrait of [SUBJECT], face close-up, clean lines, flat color, cel shading, simple background, high quality, 4k";
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const PromptHint = () => (
        <div
            className={styles.promptHint}
            onClick={handleCopyPrompt}
            title="Click to copy prompt"
        >
            <div className={styles.promptLabel}>
                <span>GENERATION PROMPT IDEA</span>
                {copied && <span className={styles.copiedLabel}>COPIED!</span>}
            </div>
            <div className={styles.promptText}>
                &quot;anime style character portrait of [SUBJECT], face close-up, clean lines...&quot;
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>PERSONA EDITOR</span>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.body}>
                    {error && <div className={styles.error}>{error}</div>}

                    {/* Persona List */}
                    <div className={styles.personaList}>
                        {personas.map(persona => (
                            <div key={persona.id} className={styles.personaItem}>
                                {editingId === persona.id ? (
                                    // Edit Mode
                                    <div className={styles.editForm}>
                                        <div className={styles.editHeader}>
                                            <span>Editing: {persona.codename}</span>
                                            {persona.isBuiltIn && (
                                                <span className={styles.builtinBadge}>BUILT-IN</span>
                                            )}
                                        </div>

                                        {!persona.isBuiltIn && (
                                            <>
                                                {/* Portrait Upload for custom */}
                                                <div className={styles.imageSection}>
                                                    <div
                                                        className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''}`}
                                                        onDragEnter={handleDrag}
                                                        onDragLeave={handleDrag}
                                                        onDragOver={handleDrag}
                                                        onDrop={(e) => handleDrop(e, true)}
                                                        onClick={() => editFileInputRef.current?.click()}
                                                    >
                                                        {editPortraitData || persona.portraitUrl ? (
                                                            <img
                                                                src={editPortraitData || persona.portraitUrl}
                                                                alt="Preview"
                                                                className={styles.previewImage}
                                                            />
                                                        ) : (
                                                            <div className={styles.dropzoneText}>
                                                                Drop image or click
                                                            </div>
                                                        )}
                                                        <input
                                                            ref={editFileInputRef}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => {
                                                                if (e.target.files?.[0]) {
                                                                    handleImageUpload(e.target.files[0], true);
                                                                }
                                                            }}
                                                            style={{ display: 'none' }}
                                                        />
                                                    </div>
                                                    <PromptHint />
                                                </div>

                                                <input
                                                    type="text"
                                                    placeholder="Name"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className={styles.input}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="CODENAME"
                                                    value={editCodename}
                                                    onChange={e => setEditCodename(e.target.value)}
                                                    className={styles.input}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Frequency (e.g. 142.00)"
                                                    value={editFrequency}
                                                    onChange={e => setEditFrequency(e.target.value)}
                                                    className={styles.input}
                                                />
                                            </>
                                        )}

                                        <textarea
                                            placeholder="System Prompt"
                                            value={editSystemPrompt}
                                            onChange={e => setEditSystemPrompt(e.target.value)}
                                            className={styles.textarea}
                                            rows={4}
                                        />

                                        <div className={styles.editActions}>
                                            <button
                                                className={styles.saveBtn}
                                                onClick={() => handleEditSubmit(persona)}
                                            >
                                                SAVE
                                            </button>
                                            <button
                                                className={styles.cancelBtn}
                                                onClick={() => setEditingId(null)}
                                            >
                                                CANCEL
                                            </button>
                                            {persona.isBuiltIn && (
                                                <button
                                                    className={styles.resetBtn}
                                                    onClick={() => {
                                                        onResetBuiltinPrompt(persona.id);
                                                        setEditingId(null);
                                                    }}
                                                >
                                                    RESET
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <>
                                        <div className={styles.personaInfo}>
                                            <div className={styles.personaPortrait}>
                                                {(persona.portraitData || persona.portraitUrl) ? (
                                                    <img
                                                        src={persona.portraitData || persona.portraitUrl}
                                                        alt={persona.codename}
                                                    />
                                                ) : (
                                                    <span>{persona.codename[0]}</span>
                                                )}
                                            </div>
                                            <div className={styles.personaDetails}>
                                                <div className={styles.personaCodename}>
                                                    {persona.codename}
                                                    {persona.isBuiltIn && (
                                                        <span className={styles.builtinBadge}>BUILT-IN</span>
                                                    )}
                                                </div>
                                                <div className={styles.personaName}>{persona.name}</div>
                                                <div className={styles.personaFreq}>{persona.frequency} MHz</div>
                                            </div>
                                        </div>
                                        <div className={styles.personaActions}>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => startEditing(persona)}
                                            >
                                                EDIT
                                            </button>
                                            {!persona.isBuiltIn && (
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDelete(persona)}
                                                >
                                                    DEL
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Form */}
                    {showAddForm ? (
                        <div className={styles.addForm}>
                            <div className={styles.formTitle}>NEW PERSONA</div>

                            <div className={styles.imageSection}>
                                <div
                                    className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''}`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={(e) => handleDrop(e, false)}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {newPortraitData ? (
                                        <img
                                            src={newPortraitData}
                                            alt="Preview"
                                            className={styles.previewImage}
                                        />
                                    ) : (
                                        <div className={styles.dropzoneText}>
                                            📷 Drop image or click to upload
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                handleImageUpload(e.target.files[0], false);
                                            }
                                        }}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                                <PromptHint />
                            </div>

                            <input
                                type="text"
                                placeholder="Name (e.g. John Doe)"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className={styles.input}
                            />
                            <input
                                type="text"
                                placeholder="CODENAME (required)"
                                value={newCodename}
                                onChange={e => setNewCodename(e.target.value)}
                                className={styles.input}
                            />
                            <input
                                type="text"
                                placeholder="Frequency (e.g. 142.00)"
                                value={newFrequency}
                                onChange={e => setNewFrequency(e.target.value)}
                                className={styles.input}
                            />
                            <textarea
                                placeholder="System Prompt (defines personality)"
                                value={newSystemPrompt}
                                onChange={e => setNewSystemPrompt(e.target.value)}
                                className={styles.textarea}
                                rows={4}
                            />

                            <div className={styles.formActions}>
                                <button className={styles.addBtn} onClick={handleAddSubmit}>
                                    CREATE
                                </button>
                                <button className={styles.cancelBtn} onClick={resetAddForm}>
                                    CANCEL
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            className={styles.newBtn}
                            onClick={() => setShowAddForm(true)}
                        >
                            + NEW PERSONA
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
