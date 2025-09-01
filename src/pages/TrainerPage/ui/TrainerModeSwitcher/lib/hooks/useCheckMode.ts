import { useCallback, useContext } from 'react';
import { ModeSwitcherItemProps } from '@/widgets/ModeSwitcher';
import { TrainerPageContext } from '../../../../model/context/TrainerPageContext';
import { useTrainerActions } from '../../../../model/slice/TrainerPageSlice';
import { useTrainerWords } from '../../../../model/selectors/getTrainerWords/getTrainerWords';

interface useCheckModeResult {
  CheckModeItem: ModeSwitcherItemProps;
}

export const useCheckMode = (): useCheckModeResult => {
  const { setIsCheckMode, isCheckMode, setIsOneLifeMode } =
    useContext(TrainerPageContext);

  const storeWords = useTrainerWords();
  const {
    changeWordProbability,
    changeWordConsecutivelyTimes,
    changeWordInProgressStatus,
  } = useTrainerActions();

  const clearProgress = useCallback(() => {
    for (const word of storeWords) {
      changeWordProbability({ id: word.id, probability: 1 });
      changeWordConsecutivelyTimes({ id: word.id, consecutivelyTimes: 0 });
      changeWordInProgressStatus({ id: word.id, inProgress: false });
    }
  }, [
    storeWords,
    changeWordProbability,
    changeWordConsecutivelyTimes,
    changeWordInProgressStatus,
  ]);

  const CheckModeToggle = useCallback(() => {
    if (!isCheckMode) setIsOneLifeMode(false);
    // перезапуск тренажёра при переключении режима
    clearProgress();
    setIsCheckMode(!isCheckMode);
  }, [isCheckMode, setIsCheckMode, setIsOneLifeMode, clearProgress]);

  const CheckModeItem = {
    name: 'Проверка',
    onClick: CheckModeToggle,
    modeIsOn: isCheckMode,
    setModeIsOn: setIsCheckMode,
    hintText: 'Слово не будут повторяться даже при допущении ошибки',
  };

  return { CheckModeItem };
};
