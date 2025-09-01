import * as styles from './MissedLetterInput.module.scss';
import { memo, useEffect, useRef } from 'react';

type MissedLetterInputSizes = 'small' | 'big';

export interface MissedLetterInputProps
  extends React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  > {
  isIncorrect?: boolean;
  isCorrect?: boolean;
  isMissed?: boolean;
  sizeProp?: MissedLetterInputSizes;
  keepFocus?: boolean;
}

export const MissedLetterInput: React.FC<MissedLetterInputProps> = memo(
  ({
    isIncorrect,
    isCorrect,
    isMissed,
    sizeProp = 'small',
    keepFocus,
    ...inputProps
  }): React.JSX.Element => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (!keepFocus) return;
      const focus = () => inputRef.current?.focus();
      requestAnimationFrame(focus);
      const el = inputRef.current;
      const handleBlur = () => requestAnimationFrame(focus);
      el?.addEventListener('blur', handleBlur);
      return () => el?.removeEventListener('blur', handleBlur);
    }, [keepFocus]);
    return (
      <input
        ref={inputRef}
        type="text"
        maxLength={1}
        autoComplete="off"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        className={`${styles.MissedLetterInput}
        ${isIncorrect ? styles.MissedLetterInput__incorrect : ''}
        ${isCorrect ? styles.MissedLetterInput__correct : ''}
        ${isMissed ? styles.MissedLetterInput__missed : ''}
        ${styles[`MissedLetterInput__${sizeProp}`]}
        `}
        {...inputProps}
      />
    );
  },
);

MissedLetterInput.displayName = 'MissedLetterInput';
