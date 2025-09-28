import { Flex } from '@/shared/lib/Stack';
import * as styles from './TrainerTotalResult.module.scss';
import { Fragment, memo, useCallback, useContext, useEffect, useMemo } from 'react';
import { useTrainerWords } from '../../model/selectors/getTrainerWords/getTrainerWords';
import {
  TrainerWordsType,
  WordsForTrainersItem,
  WordsForTrainersTypes,
} from '../../model/types/types';
import { TrainerPageContext } from '../../model/context/TrainerPageContext';
import { useTrainerActions } from '../../model/slice/TrainerPageSlice';
import { useInitializeWords, useInitializeWordsTest } from '../../lib/hooks/useInitializeWords';
import { Button } from '@/shared/ui/Button/ui/Button';
import {
  generateBlockWithUncorrectWord,
  generateBlockWithUncorrectWordArray,
} from './lib/generateBlockWithUncorrectWord';
import trainerResultsBg from '@/shared/assets/images/trainer-results-bg.png';

interface TrainerTotalResultProps {
  updateRandomWord: (words?: WordsForTrainersTypes[]) => void;
  words: WordsForTrainersItem;
  theme: string;
  type: TrainerWordsType;
}

export const TrainerTotalResult: React.FC<TrainerTotalResultProps> = memo(
  ({ updateRandomWord, words, theme, type }) => {
    const { isCheckMode, isOneLifeMode, allAttemptsCount, setAllAttemptsCount } =
      useContext(TrainerPageContext);

    const storeWords = useTrainerWords();                  // что сейчас в сторе
    console.debug(storeWords)
    const initWords  = useInitializeWordsTest(words.items); // «эталон» (из набора)
    console.debug(initWords)

    // нормализуем id (string/number) и считаем diff
    const missingFromStore = useMemo(() => {
  const storeIds = new Set(storeWords.map((w) => String(w.id)));

  return initWords
  // @ts-ignore
    .filter((w) => !storeIds.has(String(w.id)))
  // @ts-ignore
    .map((w) => ({
      ...w,
      uncorrectTimes: 1, // явно проставляем 1
    }));
}, [storeWords, initWords]);
    console.debug(missingFromStore)
    const { setWords } = useTrainerActions();
    const { totalTime, setTotalTime, isErrorWork, setIsErrorWork } =
      useContext(TrainerPageContext);

    const totalTimeMinutes = useMemo(() => Math.round(totalTime / 60000), [totalTime]);
    const totalTimeSeconds = useMemo(() => Math.round((totalTime / 1000) % 60), [totalTime]);

    // ошибки по реальным счётчикам
    const wrongByCounter = useMemo(
      () =>
        storeWords
          .filter((w) => (w.uncorrectTimes ?? 0) > 0)
          .sort((a, b) => (b.uncorrectTimes ?? 0) - (a.uncorrectTimes ?? 0)),
      [storeWords]
    );

    // Единый список ошибок: счётчики + "пропавшие" из исходного массива
    const errorWords = useMemo(() => {
      // если счётчики честные — используем их
      let src = [...wrongByCounter];

      // добавить пропавших только если нужен фоллбэк (или хочешь объединять — убери условие)
      if (src.length === 0 && missingFromStore.length > 0) {
        src = [...missingFromStore];
      }

      // дедуп по id (на случай объединения)
      const seen = new Set<string>();
      return src.filter((w) => {
        const key = String(w.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, [wrongByCounter, missingFromStore]);

    // — Работа над ошибками — теперь от errorWords
    const startErrorWork = useCallback(() => {
      setIsErrorWork(true);

      const next = errorWords.map((w) => ({
        ...w,
        probability: 1,
        uncorrectTimes: 0,
        consecutivelyTimes: 0,
        inProgress: false,
      }));

      setWords(next);
      setTotalTime(0);
      setAllAttemptsCount(0);
      updateRandomWord(next);
    }, [errorWords, setAllAttemptsCount, setIsErrorWork, setTotalTime, setWords, updateRandomWord]);

    // Повторить — как было
    const { initializeWords } = useInitializeWords(words.items);
    const Retry = useCallback(() => {
      initializeWords(); // если используешь мою новую версию — можно initializeWords({ mode:"fresh" })
      setTotalTime(0);
      setIsErrorWork(false);
      setAllAttemptsCount(0);
    }, [initializeWords, setAllAttemptsCount, setIsErrorWork, setTotalTime]);

    return (
      <Flex className={styles.TrainerTotalResult__wrapper} justify="between" direction="column" width="100" maxHeight>
        <img src={trainerResultsBg} alt="" aria-hidden className={styles.TrainerTotalResult__bgImage} />
        <span className={styles.TrainerTotalResult__totalTime}>
          Общее время: {`${totalTimeMinutes < 10 ? '0' : ''}${totalTimeMinutes}`}:
          {`${totalTimeSeconds < 10 ? '0' : ''}${totalTimeSeconds}`}
        </span>

        {isOneLifeMode && (
          <span className={styles.TrainerTotalResult__extraText}>Количество попыток: {allAttemptsCount}</span>
        )}

        <span className={styles.TrainerTotalResult__extraText}>Тема: {theme}</span>

        <span className={styles.TrainerTotalResult__extraText}>
          Режим: «Проверка»
        </span>
        {errorWords.length > 0 && !isOneLifeMode ? (
          <Flex className={styles.TrainerTotalResult__textWrapper} gap="20" justify="between" direction="column">
            <Flex direction="column">
              <span className={styles.TrainerTotalResult__totalTime}>Ошибки:</span>

              <Flex direction="column" gap="3" width="100">
                {errorWords.map((word) => (
                  <span className={styles.TrainerTotalResult__wordWithError} key={word.id}>
                    {(() => {
                      const item = generateBlockWithUncorrectWordArray(word).find((i) => i.type === type)!;
                      return generateBlockWithUncorrectWord({
                        wordObject: word,
                        words,
                        type: item.type,
                        word: item.word,
                        validWord: item.validWord,
                      });
                    })()}
                  </span>
                ))}
              </Flex>
            </Flex>

            {!isErrorWork && (
              <Button onClick={startErrorWork} type="button">
                Работа над ошибками
              </Button>
            )}
          </Flex>
        ) : (
          <Button onClick={Retry} type="button">
            Повторить
          </Button>
        )}
      </Flex>
    );
  }
);

TrainerTotalResult.displayName = 'TrainerTotalResult';