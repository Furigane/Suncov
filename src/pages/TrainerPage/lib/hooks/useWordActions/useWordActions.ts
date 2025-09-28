// useWordActions.ts
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRandomWord } from "../useRandomWord";
import { useTrainerActions } from "../../../model/slice/TrainerPageSlice";
import { playSound } from "@/shared/utils/playSound";
import { useInitializeWords } from "../useInitializeWords";
import { useTrainerWords } from "../../../model/selectors/getTrainerWords/getTrainerWords";
import { TrainerPageContext } from "../../../model/context/TrainerPageContext";
import { isInJest } from "@/shared/tests/isInJest";
import { useLocation } from "react-router-dom";
import {
  UseWordActionsResult,
  wordActionsFunctionType,
  wordActionsFunctionExtendType,
} from "./types/types";
import { keyDownEventListener } from "./helpers/keyDownEventListener";
import {
  addRefEventListener,
  deleteRefEventListener,
} from "@/shared/utils/eventListeners";

/* -------------------------------------------
   ВСПОМОГАТЕЛЬНЫЕ: компактные логгеры и diff
--------------------------------------------*/
const DBG = true; // переключатель логов

const log = (...a: any[]) => DBG && console.debug(...a);
const group = (title: string) => DBG && console.groupCollapsed(title);
const gend = () => DBG && console.groupEnd();

const compactWord = (w: any) =>
  w
    ? `id=${w.id} u=${w.uncorrectTimes ?? 0} p=${w.probability} c=${w.consecutivelyTimes ?? 0} in=${w.inProgress}`
    : "null";

/* =====================================================
   ГЛАВНЫЙ ХУК
===================================================== */
export const useWordActions = (
  randomWordId: number | null,
  setRandomWordsIsReverse: React.Dispatch<React.SetStateAction<boolean>>,
  setRandomWordId: React.Dispatch<React.SetStateAction<number | null>>,
  setIsIncorrect: React.Dispatch<React.SetStateAction<boolean>>
): UseWordActionsResult => {
  // экшены из стора
  const {
    changeWordProbability: _changeWordProbability,
    changeWordUncorrectTimes: _changeWordUncorrectTimes,
    changeWordConsecutivelyTimes: _changeWordConsecutivelyTimes,
    changeWordInProgressStatus: _changeWordInProgressStatus,
    deleteWord: _deleteWord,
  } = useTrainerActions();

  // обёртки с логами (удобно отлаживать)
  const changeWordProbability = (p: any) => {
    log("%c[action] changeWordProbability", "color:#f80", p);
    _changeWordProbability(p);
  };
  const changeWordUncorrectTimes = (p: any) => {
    log("%c[action] changeWordUncorrectTimes", "color:#f80", p);
    _changeWordUncorrectTimes(p);
  };
  const changeWordConsecutivelyTimes = (p: any) => {
    log("%c[action] changeWordConsecutivelyTimes", "color:#f80", p);
    _changeWordConsecutivelyTimes(p);
  };
  const changeWordInProgressStatus = (p: any) => {
    log("%c[action] changeWordInProgressStatus", "color:#f80", p);
    _changeWordInProgressStatus(p);
  };
  const deleteWord = (p: any) => {
    log("%c[action] deleteWord", "color:#f80", p);
    _deleteWord(p);
  };

  const storeWords = useTrainerWords();
  const { initializeWords } = useInitializeWords(storeWords);

  const { isOneLifeMode, isCheckMode, setAllAttemptsCount } =
    useContext(TrainerPageContext);

  const { pathname } = useLocation();
  const isRazryadyTrainer = /\/trainers\/razryady/i.test(decodeURI(pathname));

  // если в «разрядах» — откладываем начисление ошибки до показа следующего слова
  const pendingFailRef = useRef<number | null>(null);

  const [waitRepeatedClickInFail, setWaitRepeatedClickInFail] =
    useState<boolean>(false);

  const { updateRandomWord } = useRandomWord(
    randomWordId,
    setRandomWordsIsReverse,
    setRandomWordId
  );

  // refs для слушателей
  const keydownEventListenerRef = useRef<((e: KeyboardEvent) => void) | null>(
    null
  );
  const clickEventListenerRef = useRef<(() => void) | null>(null);

  /* -------------------------------------------
     ПОКАЗ НОВОГО СЛОВА (+ flush отложенной ошибки)
  --------------------------------------------*/
  const showNewWord: wordActionsFunctionType = useCallback(
    (words, isErrorWork, randomWordId) => {
      // снять слушатели
      deleteRefEventListener(clickEventListenerRef, "click");
      deleteRefEventListener(keydownEventListenerRef, "keydown");

      // вернуть клики на основной контейнер
      const main: HTMLElement = document.querySelector("main")!;
      if (!isInJest()) main.style.pointerEvents = "all";

      // в «одна жизнь» — сбрасываем и считаем попытку
      if (isOneLifeMode) {
        initializeWords();
        setAllAttemptsCount((prev) => prev + 1);
      }

      setWaitRepeatedClickInFail(false);
      setIsIncorrect(false);

      const currentRandomWord = words.find((w) => w.id === randomWordId);
      if (!currentRandomWord) return;

      // снять inProgress со слова которое только что показали
      changeWordInProgressStatus({ id: currentRandomWord.id, inProgress: false });

      // режим «проверка»: пометили вероятности и вернули в inProgress
      if (isCheckMode) {
        changeWordProbability({ id: currentRandomWord.id, probability: 0 });
        changeWordInProgressStatus({ id: currentRandomWord.id, inProgress: true });
      }

      // 🔥 FLUSH отложенной ошибки для «разрядов»
      if (pendingFailRef.current != null) {
        const failId = pendingFailRef.current;
        pendingFailRef.current = null;

        const base = words.find((w) => w.id === failId);
        const prevU = base?.uncorrectTimes ?? 0;

        log("%c[razryady] FLUSH fail", "color:#0af", {
          id: failId,
          from: prevU,
          to: prevU + 1,
        });

        changeWordUncorrectTimes({ id: failId, uncorrectTimes: prevU + 1 });
        changeWordProbability({ id: failId, probability: 0.2 });
      }

      updateRandomWord();
    },
    [
      changeWordInProgressStatus,
      changeWordProbability,
      initializeWords,
      isCheckMode,
      isOneLifeMode,
      setAllAttemptsCount,
      setIsIncorrect,
      updateRandomWord,
    ]
  );

  /* -------------------------------------------
     НЕВЕРНЫЙ ОТВЕТ
  --------------------------------------------*/
  const wordOnFail: wordActionsFunctionExtendType = useCallback(
    (words, isErrorWork, randomWordId, type, elemForClick = document) => {
      if (waitRepeatedClickInFail) return;

      const currentRandomWord = words.find((w) => w.id === randomWordId);
      if (!currentRandomWord) return;

      group("[FAIL] " + compactWord(currentRandomWord));

      if (!isErrorWork) {
        if (isRazryadyTrainer) {
          // отложим на показ следующего слова
          pendingFailRef.current = currentRandomWord.id;
          setAllAttemptsCount?.((p: number) => p + 1);
          log("[razryady] schedule fail for id", currentRandomWord.id);
        } else {
          // обычные тренажёры — начисляем сразу
          changeWordUncorrectTimes({
            id: currentRandomWord.id,
            uncorrectTimes: (currentRandomWord.uncorrectTimes ?? 0) + 1,
          });
          changeWordProbability({ id: currentRandomWord.id, probability: 0.2 });
        }
      }

      // серии уменьшаем сразу (один раз)
      changeWordConsecutivelyTimes({
        id: currentRandomWord.id,
        consecutivelyTimes: Math.max(
          (currentRandomWord.consecutivelyTimes ?? 0) - 1,
          0
        ),
      });

      // и снимаем inProgress (один раз)
      changeWordInProgressStatus({ id: currentRandomWord.id, inProgress: false });

      playSound("FailSound");
      setIsIncorrect(true);
      setWaitRepeatedClickInFail(true);

      // временно блокируем клики по main
      const main: HTMLElement = document.querySelector("main")!;
      if (!isInJest()) main.style.pointerEvents = "none";

      // слушатели: один «лишний» клик/keydown — только подсветка, потом showNewWord
      let isFirstClick = true;

      addRefEventListener(
        clickEventListenerRef,
        "click",
        () => {
          if (isFirstClick) {
            isFirstClick = false;
            return;
          }
          showNewWord(words, isErrorWork, randomWordId);
          deleteRefEventListener(clickEventListenerRef, "click");
        },
        elemForClick,
        type === "choice"
      );

      addRefEventListener(
        keydownEventListenerRef,
        "keydown",
        (e: KeyboardEvent) => {
          keyDownEventListener(e, showNewWord, words, isErrorWork, randomWordId);
          deleteRefEventListener(keydownEventListenerRef, "keydown");
        },
        document,
        type === "choice"
      );

      gend();
    },
    [
      changeWordConsecutivelyTimes,
      changeWordInProgressStatus,
      changeWordUncorrectTimes,
      changeWordProbability,
      setAllAttemptsCount,
      setIsIncorrect,
      showNewWord,
      waitRepeatedClickInFail,
      isRazryadyTrainer,
    ]
  );

  /* -------------------------------------------
     ВЕРНЫЙ ОТВЕТ
  --------------------------------------------*/
  const wordOnSuccess: wordActionsFunctionType = useCallback(
    (words, isErrorWork, randomWordId) => {
      if (waitRepeatedClickInFail) return;

      const currentRandomWord = words.find((w) => w.id === randomWordId);
      if (!currentRandomWord) return;

      group("[SUCCESS] " + compactWord(currentRandomWord));

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
          updatedWords = words.filter((w) => w.id !== currentRandomWord.id);
        }
      } else {
        if (currentRandomWord.probability === 0.2) {
          changeWordProbability({ id: currentRandomWord.id, probability: 0.1 });
          rollbackInProgress = true;
        } else if (currentRandomWord.probability === 0.1) {
          changeWordProbability({ id: currentRandomWord.id, probability: 0.05 });
          rollbackInProgress = true;
        } else {
          changeWordProbability({
            id: currentRandomWord.id,
            probability: isOneLifeMode ? 0 : 0.01,
          });
        }
        changeWordInProgressStatus({ id: currentRandomWord.id, inProgress: true });
      }

      if (isCheckMode) {
        changeWordProbability({ id: currentRandomWord.id, probability: 0 });
      }

      // задержка для мобильных, чтобы не подсвечивался клик
      const t = setTimeout(() => {
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
        clearTimeout(t);
        gend();
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
    ]
  );

  /* -------------------------------------------
     Визуальный лог изменения storeWords (опционально)
  --------------------------------------------*/
  const prevStoreRef = useRef(storeWords);
  useEffect(() => {
    if (!DBG) return;
    if (prevStoreRef.current !== storeWords) {
      const prev = prevStoreRef.current;
      const toMap = (arr: any[]) =>
        arr.map((w) => ({
          id: w.id,
          u: w.uncorrectTimes ?? 0,
          p: w.probability,
          c: w.consecutivelyTimes ?? 0,
          in: w.inProgress ? 1 : 0,
        }));
      console.table({
        BEFORE: toMap(prev),
        AFTER: toMap(storeWords),
      });
      prevStoreRef.current = storeWords;
    }
  }, [storeWords]);

  return {
    showNewWord,
    wordOnSuccess,
    wordOnFail,
  };
};
