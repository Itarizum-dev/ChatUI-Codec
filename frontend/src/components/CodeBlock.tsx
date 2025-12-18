import { Check, Clipboard } from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
    language: string;
    value: string;
}

export const CodeBlock = ({ language, value }: CodeBlockProps) => {
    const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = async () => {
        if (!navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(value);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="code-block-wrapper" style={{
            margin: '12px 0',
            border: '1px solid var(--codec-green-dim)',
            borderRadius: '2px', // Sharper corners for Codec look
            overflow: 'hidden',
            background: '#0a0f0a'
        }}>
            <div className="code-block-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                background: 'rgba(0, 40, 20, 0.6)',
                borderBottom: '1px solid var(--codec-green-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--codec-green-mid)'
            }}>
                <span style={{
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    fontWeight: 'bold'
                }}>
                    {language || 'text'}
                </span>
                <button
                    onClick={copyToClipboard}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: isCopied ? 'var(--codec-green-bright)' : 'var(--codec-green-dim)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.7rem',
                        transition: 'all 0.2s',
                        letterSpacing: '1px'
                    }}
                    title="Copy to Clipboard"
                >
                    {isCopied ? (
                        <>
                            <Check size={14} />
                            <span>COPIED</span>
                        </>
                    ) : (
                        <>
                            <Clipboard size={14} />
                            <span>COPY</span>
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                style={atomDark}
                customStyle={{
                    margin: 0,
                    padding: '16px',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(0, 5, 2, 0.95)', // Very dark background
                }}
                wrapLongLines={true}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
};
