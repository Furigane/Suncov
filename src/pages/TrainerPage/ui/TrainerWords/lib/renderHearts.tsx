import { TrainerWordsInterface } from '../../../model/types/types';
import * as styles from './renderHearts.module.scss';
import React, { useEffect, useRef, useState } from 'react';

import { parseGIF, decompressFrames } from 'gifuct-js';

import heartEmptyImg from '@/shared/assets/hearts/heart-empty.png';
import heartFilledImg from '@/shared/assets/hearts/heart-filled.png';
import heartOneImg from '@/shared/assets/hearts/heart-one.png';
import heartAshGif from '@/shared/assets/hearts/test2.gif';


export interface HeartIcons {
  empty?: React.ReactNode;
  filled?: React.ReactNode;
  oneLifeLose?: React.ReactNode;
}

const doneAnims = new Set<string>([
  styles['heart-pop'] || 'heart-pop',
  styles['heart-lose'] || 'heart-lose',
  styles['heart-explode'] || 'heart-explode',
  styles['heart-spawn'] || 'heart-spawn',
  styles['heart-appear'] || 'heart-appear',
]);

const imgNode = (src: string, alt: string) => (
  <img src={src} alt={alt} className={styles.heartImg} draggable={false} />
);

const defaultEmptyNode = imgNode(heartEmptyImg, 'empty heart');
const defaultFilledNode = imgNode(heartFilledImg, 'filled heart');
const oneLifeNode = imgNode(heartOneImg, 'one life heart');

const gifCache = new Map<string, { frames: any[]; width: number; height: number }>();
const loading = new Map<string, Promise<void>>();

function prewarmGif(src: string) {
  if (gifCache.has(src) || loading.has(src)) return;
  const p = (async () => {
    const res = await fetch(src);
    const buf = await res.arrayBuffer();
    const gif = parseGIF(buf);
    const frames = decompressFrames(gif, true);
    gifCache.set(src, {
      frames,
      width: frames[0].dims.width,
      height: frames[0].dims.height,
    });
  })();
  loading.set(src, p);
  p.finally(() => loading.delete(src));
}

prewarmGif(heartAshGif);

const GifOnce: React.FC<{
  src: string;
  className?: string;
  speed?: number;           // 1 = нормальная
  onFirstPaint?: () => void;
}> = ({ src, className, speed = 15, onFirstPaint }) => {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    let killed = false;
    let t: number | null = null;

    (async () => {
      // дождёмся предзагрузки, если идёт
      if (loading.has(src)) await loading.get(src);

      // если всё ещё нет — загрузим локально (на всякий случай)
      if (!gifCache.has(src)) {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        const gif = parseGIF(buf);
        const frames = decompressFrames(gif, true);
        gifCache.set(src, {
          frames,
          width: frames[0].dims.width,
          height: frames[0].dims.height,
        });
      }

      const cached = gifCache.get(src)!;
      const frames = cached.frames;
      const canvas = ref.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      canvas.width = cached.width;
      canvas.height = cached.height;

      let i = 0;
      let firstPaintDone = false;

      const draw = () => {
        if (killed) return;
        const f = frames[i];

        const id = ctx.createImageData(f.dims.width, f.dims.height);
        id.data.set(f.patch);
        ctx.putImageData(id, f.dims.left, f.dims.top);

        if (!firstPaintDone) {
          firstPaintDone = true;
          onFirstPaint?.();           // сообщаем: первый кадр показан
        }

        const delayMs = Math.max(16, (f.delay || 10) * 10 / (speed || 1));

        if (i < frames.length - 1) {
          t = window.setTimeout(() => { i += 1; draw(); }, delayMs);
        } else {
          // последний кадр — просто остаёмся
          t = null;
        }
      };

      draw();
    })();

    return () => { killed = true; if (t) window.clearTimeout(t); };
  }, [src, speed, onFirstPaint]);

  // визуально подгоняем под сердце
  return <canvas ref={ref} className={className} style={{ width: 33, height: 33 }} />;
};



export const renderHearts = (
  randomWord: TrainerWordsInterface,
  isOneLifeMode: boolean,
  icons: HeartIcons = {},
) => {
  const uncorrectTimes = randomWord.uncorrectTimes ?? 0;
  const consecutivelyTimes = randomWord.consecutivelyTimes ?? 0;

  let empty: React.ReactNode = defaultEmptyNode;
  let filled: React.ReactNode = defaultFilledNode;

  // 👇 ВНУТРИ функции — вычисляем ноду для one-life ошибки (с учётом иконок)
    const oneLifeLoseNode =
    icons.oneLifeLose ?? (
      <GifOnce src={heartAshGif} className={styles.heartImg} />
    );

  // Спец. логика для режима одной жизни
  if (isOneLifeMode) {
    filled = oneLifeNode;      // картинка «1 жизнь» когда всё ок
    empty  = defaultEmptyNode; // а при ошибке показываем oneLifeLoseNode, см. ниже
  } else {
    if (icons.empty)  empty = icons.empty;
    if (icons.filled) filled = icons.filled;
  }

  const heartsCount: 1 | 3 = isOneLifeMode ? 1 : (uncorrectTimes > 0 ? 3 : 1);

  const filledCount =
    isOneLifeMode
      ? (uncorrectTimes === 0 ? 1 : 0)
      : (randomWord.inProgress
          ? heartsCount
          : heartsCount === 3
            ? Math.min(consecutivelyTimes, heartsCount)
            : 0);

  return (
    <span className={styles.TrainerHearts}>
      {Array.from({ length: heartsCount }).map((_, index) => (
        <Heart
          key={index}
          filled={index < filledCount}
          filledNode={filled}
          emptyNode={empty}
          oneLifeLoseNode={oneLifeLoseNode}   // 👈 передаём сюда
          isOneLifeMode={isOneLifeMode}
        />
      ))}
    </span>
  );
};

interface HeartProps {
  filled: boolean;
  filledNode: React.ReactNode;
  emptyNode: React.ReactNode;
  oneLifeLoseNode: React.ReactNode;  // есть в пропсах
  isOneLifeMode: boolean;
}

const Heart: React.FC<HeartProps> = ({
  filled,
  filledNode,
  emptyNode,
  oneLifeLoseNode,
  isOneLifeMode,
}) => {
  const prevFilled = useRef<boolean>(filled);
  const [animClass, setAnimClass] = useState<string>(() =>
    !filled ? styles.TrainerHearts__heart__appear : styles.TrainerHearts__heart__spawn
  );

  useEffect(() => {
    if (prevFilled.current !== filled) {
      if (isOneLifeMode && prevFilled.current === true && filled === false) {
        // при потере в one-life глушим чужие анимации
        setAnimClass(styles.TrainerHearts__heart__lock);
      } else {
        setAnimClass(filled ? styles.TrainerHearts__heart__add : styles.TrainerHearts__heart__lose);
      }
      prevFilled.current = filled;
    }
  }, [filled, isOneLifeMode]);

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLSpanElement>) => {
    if (doneAnims.has(e.animationName)) setAnimClass('');
  };

  const className = [
    styles.TrainerHearts__heart,
    filled ? styles.TrainerHearts__heart__filled : styles.TrainerHearts__heart__empty,
    isOneLifeMode && filled ? styles.TrainerHearts__heart__pulse : '',
    animClass,
  ].filter(Boolean).join(' ');

  // КАКОЙ узел показать
  const nodeToShow = filled
    ? filledNode
    : (isOneLifeMode ? oneLifeLoseNode : emptyNode);

  return (
    <span className={className} aria-label={filled ? 'filled' : 'empty'} onAnimationEnd={handleAnimationEnd}>
      {nodeToShow}
    </span>
  );
};
