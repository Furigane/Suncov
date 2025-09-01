import { useCallback } from 'react';
import { useTrainerActions } from '../../../../model/slice/TrainerPageSlice';
import { useTrainerWords } from '../../../../model/selectors/getTrainerWords/getTrainerWords';

export const useTrainerReset = () => {
  const storeWords = useTrainerWords();
  const {
    changeWordProbability,
    changeWordConsecutivelyTimes,
    changeWordInProgressStatus,
  } = useTrainerActions();

  const reset = useCallback(() => {
    for (const w of storeWords) {
      changeWordProbability({ id: w.id, probability: 1 });
      changeWordConsecutivelyTimes({ id: w.id, consecutivelyTimes: 0 });
      changeWordInProgressStatus({ id: w.id, inProgress: false });
    }
  }, [
    storeWords,
    changeWordProbability,
    changeWordConsecutivelyTimes,
    changeWordInProgressStatus,
  ]);

  return reset;
};
