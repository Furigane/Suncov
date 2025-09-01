import { useCallback, useContext, useRef, useState } from 'react';
import { useRandomWord } from '../useRandomWord';
import { useTrainerActions } from '../../../model/slice/TrainerPageSlice';
import { playSound } from '@/shared/utils/playSound';
import { useInitializeWords } from '../useInitializeWords';
import { useTrainerWords } from '../../../model/selectors/getTrainerWords/getTrainerWords';
import { TrainerPageContext } from '../../../model/context/TrainerPageContext';
import { isInJest } from '@/shared/tests/isInJest';
import { useLocation } from 'react-router-dom';

import {
  UseWordActionsResult,
  wordActionsFunctionType,
  wordActionsFunctionExtendType,
} from './types/types';
import { keyDownEventListener } from './helpers/keyDownEventListener';
import {
  addRefEventListener,
  deleteRefEventListener,
} from '@/shared/utils/eventListeners';

export const useWordActions = (
  randomWordId: number | null,
  setRandomWordsIsReverse: React.Dispatch<React.SetStateAction<boolean>>,
  setRandomWordId: React.Dispatch<React.SetStateAction<number | null>>,
  setIsIncorrect: React.Dispatch<React.SetStateAction<boolean>>,
): UseWordActionsResult => {
  // Инициализация данных
  const {
    changeWordProbability,
    changeWordUncorrectTimes,
    changeWordConsecutivelyTimes,
    changeWordInProgressStatus,
    deleteWord,
  } = useTrainerActions();

  const storeWords = useTrainerWords();

  const { initializeWords } = useInitializeWords(storeWords);

  const { isOneLifeMode, isCheckMode, setAllAttemptsCount } =
    useContext(TrainerPageContext);

const { pathname } = useLocation();
const isRazryadyTrainer = /\/trainers\/razryady/i.test(decodeURI(pathname));
const pendingFailRef = useRef<number | null>(null); 

  // Изменение вероятности при неправильном ответе
  const [waitRepeatedClickInFail, setWaitRepeatedClickInFail] =
    useState<boolean>(false);

  const { updateRandomWord } = useRandomWord(
    randomWordId,
    setRandomWordsIsReverse,
    setRandomWordId,
  );

  // Добавляем ref для хранения обработчиков событий
  const keydownEventListenerRef = useRef<((e: KeyboardEvent) => void) | null>(
    null,
  );
  const clickEventListenerRef = useRef<(() => void) | null>(null);

  // Показ нового слова
  const showNewWord: wordActionsFunctionType = useCallback(
    (words, isErrorWork, randomWordId) => {
      // Удаляем обработчики событий
      deleteRefEventListener(clickEventListenerRef, 'click');
      deleteRefEventListener(keydownEventListenerRef, 'keydown');

      // Изменяем стили обратно
      const main: HTMLElement = document.querySelector('main')!;

      if (!isInJest()) {
        main.style.pointerEvents = 'all';
      }

      // Функционал показа нового слова
      if (isOneLifeMode) {
        initializeWords();
        setAllAttemptsCount((prev) => prev + 1);
      }

      setWaitRepeatedClickInFail(false);
      setIsIncorrect(false);

      const currentRandomWord = words.find((word) => word.id === randomWordId);

      if (!currentRandomWord) return;

      changeWordInProgressStatus({
        id: currentRandomWord.id,
        inProgress: false,
      });

      if (isCheckMode) {
        changeWordProbability({
          id: currentRandomWord.id,
          probability: 0,
        });

        changeWordInProgressStatus({
          id: currentRandomWord.id,
          inProgress: true,
        });
      }

      updateRandomWord();
    },
    [
      changeWordConsecutivelyTimes,
      changeWordInProgressStatus,
      changeWordProbability,
      initializeWords,
      isCheckMode,
      isOneLifeMode,
      setAllAttemptsCount,
      setIsIncorrect,
      updateRandomWord,
    ],
  );

  // Изменение вероятности при правильном ответе
  const wordOnFail: wordActionsFunctionExtendType = useCallback(
    (words, isErrorWork, randomWordId, type, elemForClick = document) => {



      if (waitRepeatedClickInFail) return;

      const currentRandomWord = words.find((word) => word.id === randomWordId);

      if (!currentRandomWord) return;

      if (!isErrorWork) {
      if (isRazryadyTrainer) {
        // отложим изменение стора — подсветка должна отработать
        pendingFailRef.current = currentRandomWord.id;
        // сердце можно дёрнуть локально, если нужно
        setAllAttemptsCount?.((p: number) => p + 1);
      } else {
        // обычные тренажёры — как раньше
        changeWordUncorrectTimes({
          id: currentRandomWord.id,
          uncorrectTimes: (currentRandomWord.uncorrectTimes ?? 0) + 1,
        });
        changeWordProbability({ id: currentRandomWord.id, probability: 0.2 });
      }
    }

    // серии можно обновить сразу — это не ломает подсветку
    changeWordConsecutivelyTimes({
      id: currentRandomWord.id,
      consecutivelyTimes: Math.max((currentRandomWord.consecutivelyTimes ?? 0) - 1, 0),
    });

      changeWordConsecutivelyTimes({
        id: currentRandomWord.id,
        consecutivelyTimes: Math.max(
          (currentRandomWord.consecutivelyTimes ?? 0) - 1,
          0,
        ),
      });

      changeWordInProgressStatus({ id: currentRandomWord.id, inProgress: false });


      changeWordInProgressStatus({
        id: currentRandomWord.id,
        inProgress: false,
      });

      playSound('FailSound');

      setIsIncorrect(true);

      setWaitRepeatedClickInFail(true);

      const main: HTMLElement = document.querySelector('main')!;

      if (!isInJest()) {
        main.style.pointerEvents = 'none';
      }

      // Добавляем обработчики
      let isFirstClick = true; // Флаг для того, чтобы не вызывать showNewWord при первом клике
      addRefEventListener(
        clickEventListenerRef,
        'click',
        () => {
          if (isFirstClick) {
            isFirstClick = false;
            return;
          }

          showNewWord(words, isErrorWork, randomWordId);

          deleteRefEventListener(clickEventListenerRef, 'click');
        },
        elemForClick,
        type === 'choice',
      );

      addRefEventListener(
        keydownEventListenerRef,
        'keydown',
        (e: KeyboardEvent) => {
          keyDownEventListener(
            e,
            showNewWord,
            words,
            isErrorWork,
            randomWordId,
          );

          deleteRefEventListener(keydownEventListenerRef, 'keydown');
        },
        document,
        type === 'choice',
      );
    },
    [
      changeWordConsecutivelyTimes,
      changeWordInProgressStatus,
      changeWordUncorrectTimes,
      setIsIncorrect,
      showNewWord,
      waitRepeatedClickInFail,
    ],
  );

  // Изменение вероятности при правильном ответе
  const wordOnSuccess: wordActionsFunctionType = useCallback(
    (words, isErrorWork, randomWordId) => {
      if (waitRepeatedClickInFail) return;

      const currentRandomWord = words.find((word) => word.id === randomWordId);

      if (!currentRandomWord) return;

      const isErrorRepeat =
        isErrorWork || (currentRandomWord.uncorrectTimes ?? 0) > 0;

      let rollbackInProgress = false;
      let isWordLearned = false;
      let updatedWords = words;

      if (isErrorRepeat) {
        const futureConsecutivelyTimes =
          (currentRandomWord.consecutivelyTimes ?? 0) + 1;

        changeWordConsecutivelyTimes({
          id: currentRandomWord.id,
          consecutivelyTimes: futureConsecutivelyTimes,
        });

        if (futureConsecutivelyTimes === 3) {
          isWordLearned = true;
          updatedWords = words.filter(
            (word) => word.id !== currentRandomWord.id,
          );
        }
      } else {
        if (currentRandomWord.probability === 0.2) {
          changeWordProbability({
            id: currentRandomWord.id,
            probability: 0.1,
          });
          rollbackInProgress = true;
        } else if (currentRandomWord.probability === 0.1) {
          changeWordProbability({
            id: currentRandomWord.id,
            probability: 0.05,
          });
          rollbackInProgress = true;
        } else {
          changeWordProbability({
            id: currentRandomWord.id,
            probability: isOneLifeMode ? 0 : 0.01,
          });

        }
        changeWordInProgressStatus({
          id: currentRandomWord.id,
          inProgress: true,
        });
      }

      if (isCheckMode) {
        changeWordProbability({
          id: currentRandomWord.id,
          probability: 0,
        });
      }

      // Костыль, чтобы на мобильных устройствах не было видно, какой элемент был нажат
      const timeoutForUpdate = setTimeout(() => {
        if (!isErrorRepeat && rollbackInProgress) {
          changeWordInProgressStatus({
            id: currentRandomWord.id,
            inProgress: false,
          });
        }
        if (isWordLearned) {
          deleteWord({ id: currentRandomWord.id });
          updateRandomWord(updatedWords);
        } else {
          updateRandomWord();
        }
      clearTimeout(timeoutForUpdate);
      }, 500);
    },
    [
      changeWordConsecutivelyTimes,
      changeWordInProgressStatus,
      changeWordProbability,
      deleteWord,
      isCheckMode,
      isOneLifeMode,
      updateRandomWord,
      waitRepeatedClickInFail,
    ],
  );

  return {
    showNewWord,
    wordOnSuccess,
    wordOnFail,
  };
};
