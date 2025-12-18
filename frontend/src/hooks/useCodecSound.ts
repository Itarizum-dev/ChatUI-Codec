import { useCallback, useRef, useEffect } from 'react';

export const useCodecSound = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const isMutedRef = useRef(false);

    useEffect(() => {
        // Initialize AudioContext on first user interaction if needed, 
        // but here we just try to create it.
        // It might be suspended until user interaction.
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioContextRef.current = new AudioContextClass();
        }

        return () => {
            audioContextRef.current?.close();
        };
    }, []);

    const playTone = (freq: number, type: OscillatorType, duration: number, startTime = 0) => {
        if (!audioContextRef.current || isMutedRef.current) return;

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.1, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    };

    const playTypeSound = useCallback(() => {
        // Random high pitch beep for typing
        // Frequency between 1200 and 2000 Hz for that "data" sound
        // Or specific notes for MGS style
        if (Math.random() > 0.7) { // Don't play on every single char to avoid annoyance
            const freq = 3000 + Math.random() * 500;
            playTone(freq, 'square', 0.05);
        }
    }, []);

    const playCallSound = useCallback(() => {
        if (!audioContextRef.current || isMutedRef.current) return;
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        // Classic Codec Ring: Two tones alternating
        // Tone 1: ~1400Hz, Tone 2: ~2000Hz?
        // Let's approximate the "Brrrt-Brrrt" sound

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';

        // Modulate frequency to create the trill
        osc.frequency.setValueAtTime(1500, now);
        osc.frequency.setValueAtTime(1500, now + 0.05);
        osc.frequency.setValueAtTime(2500, now + 0.05);
        osc.frequency.setValueAtTime(2500, now + 0.10);

        // Repeat this pattern
        // WebAudio scheduling is precise
        // But a loop is easier with an LFO or just scheduling a burst

        // Let's make a single "Call" burst
        for (let i = 0; i < 10; i++) {
            const t = now + i * 0.1;
            playTone(1500, 'square', 0.05, i * 0.1);
            playTone(2500, 'square', 0.05, i * 0.1 + 0.05);
        }
    }, []);

    const playOpenSound = useCallback(() => {
        // Simple "Open" sound
        playTone(1200, 'sine', 0.1);
        playTone(2000, 'sine', 0.2, 0.1);
    }, []);

    const toggleMute = (mute: boolean) => {
        isMutedRef.current = mute;
    };

    return { playTypeSound, playCallSound, playOpenSound, toggleMute };
};
