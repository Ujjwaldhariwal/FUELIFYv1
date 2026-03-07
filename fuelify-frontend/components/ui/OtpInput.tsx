// fuelify-frontend/components/ui/OtpInput.tsx
'use client';

import { useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

interface OtpInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  error?: string;
}

export const OtpInput = ({ length = 6, onComplete, error }: OtpInputProps) => {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (index: number, char: string) => {
    const next = [...values];
    next[index] = char.slice(-1);
    setValues(next);

    if (char && index < length - 1) inputRefs.current[index + 1]?.focus();

    const joined = next.join('');
    if (joined.length === length && !next.includes('')) onComplete(joined);
  };

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);

    const next = [...values];
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });

    setValues(next);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();

    if (pasted.length === length) onComplete(pasted);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={values[i]}
            onChange={(e) => update(i, e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            className={`h-14 w-12 rounded-xl border-2 bg-[var(--bg-elevated)] text-center text-xl font-bold text-[var(--text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--focus-ring)] ${
              error ? 'border-[var(--color-error)]' : values[i] ? 'border-[var(--accent-primary)]' : 'border-[var(--border)]'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-center text-sm text-[var(--color-error)]">{error}</p>}
    </div>
  );
};
