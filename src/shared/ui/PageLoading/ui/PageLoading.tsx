import * as styles from './PageLoading.module.scss';
import { memo } from 'react';
import { Flex } from '@/shared/lib/Stack';

const base = (() => {
  if (__IS_DEV__) return '';
  const ds = document.body.dataset;
  const publicUrl = (ds.publicurl ?? '').trim();
  return publicUrl ? `/${publicUrl}` : '';   // напр. /RUSS
})();

export const PageLoading: React.FC = memo((): React.JSX.Element => {
  return (
    <Flex data-testid="Loading" justify="center" className={styles.PageLoading}>
      <img
        src={`${base}/gifs/PageLoading.gif`}
        alt="Анимация загрузки страниц"
      />
    </Flex>
  );
});
PageLoading.displayName = 'PageLoading';
