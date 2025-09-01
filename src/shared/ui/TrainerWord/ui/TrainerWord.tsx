import * as styles from './TrainerWord.module.scss';
import { Flex } from '@/shared/lib/Stack';

type TrainerWordTypes = 'default' | 'invalid';

interface TrainerWordProps {
  className?: string;
  style?: React.CSSProperties;
  dataTestId?: string;
  onClick?: () => void;
  type?: TrainerWordTypes;
  children: React.ReactNode;
  disabled?: boolean;
}

export const TrainerWord: React.FC<TrainerWordProps> = ({
  className,
  style,
  dataTestId,
  onClick,
  children,
  type = 'default',
  disabled = false,
}): React.JSX.Element => {
  // Добавление, к переданной onClick функции, пропадания transition при клике на слово
  const handleClick = () => {
    if (disabled) return
    const TrainerWords = document.querySelectorAll(
      '[data-name="TrainerWord"]',
    ) as NodeListOf<HTMLElement>;

    TrainerWords.forEach((word) => {
      word.style.transitionDuration = '0ms';
    });

    const timeoutForTransition = setTimeout(() => {
      clearTimeout(timeoutForTransition);

      TrainerWords.forEach((word) => {
        word.style.transitionDuration = 'var(--transition-duration-default)';
      });
    }, 100);

    if (onClick) {
      onClick();
    }
  };

   return (
    <Flex
      justify="center"
      data-testid={dataTestId}
      width="100"
      onClick={handleClick}
      className={[
        styles.TrainerWord,
        className,
        styles[`TrainerWord__${type}`],
        disabled ? styles.TrainerWord__disabled : '',
      ].filter(Boolean).join(' ')}
      style={style}
      data-name="TrainerWord"
    >
      {children}
    </Flex>
  );
};

TrainerWord.displayName = 'TrainerWord';
