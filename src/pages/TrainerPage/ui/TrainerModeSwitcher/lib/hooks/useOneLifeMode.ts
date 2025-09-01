import { useCallback, useContext } from 'react';
import { ModeSwitcherItemProps } from '@/widgets/ModeSwitcher';
import { TrainerPageContext } from '../../../../model/context/TrainerPageContext';
import { useTrainerActions } from '../../../../model/slice/TrainerPageSlice';
import { useTrainerWords } from '../../../../model/selectors/getTrainerWords/getTrainerWords'; // <-- добавь

interface useOneLifeModeResult {
  OneLifeModeItem: ModeSwitcherItemProps;
}

export const useOneLifeMode = (): useOneLifeModeResult => {
  const { setIsOneLifeMode, isOneLifeMode, setIsCheckMode } =
    useContext(TrainerPageContext);

  const {
    changeWordProbability,
    changeWordConsecutivelyTimes,
    changeWordInProgressStatus,
  } = useTrainerActions();

  const storeWords = useTrainerWords(); // <-- добавь

  const clearProgress = useCallback(() => {
    for (const word of storeWords) {
      changeWordProbability({ id: word.id, probability: 1 });
      changeWordConsecutivelyTimes({ id: word.id, consecutivelyTimes: 0 });
      changeWordInProgressStatus({ id: word.id, inProgress: false });
    }
  }, [
    changeWordConsecutivelyTimes,
    changeWordInProgressStatus,
    changeWordProbability,
    storeWords,
  ]);

  const OneLifeModeToggle = useCallback(() => {
    if (!isOneLifeMode) setIsCheckMode(false);
    clearProgress();
    setIsOneLifeMode(!isOneLifeMode);
  }, [isOneLifeMode, setIsCheckMode, setIsOneLifeMode, clearProgress]);

  const OneLifeModeItem = {
    name: 'Одна жизнь',
    onClick: OneLifeModeToggle,
    modeIsOn: isOneLifeMode,
    setModeIsOn: setIsOneLifeMode,
    hintText: 'Прогресс обнуляется при первой же ошибке',
  };

  return {
    OneLifeModeItem,
  };
};