import { isInJest } from '../tests/isInJest';

type soundsTypes = 'FailSound';

// кэшируем базовый путь один раз
const BASE = (() => {
  if (__IS_DEV__) return '';
  const ds = document.body?.dataset || {};
  const p = (ds.publicurl || '').trim(); // из <body data-publicurl="RUSS">
  return p ? `/${p}` : '';
})();

export const playSound = (sound: soundsTypes): void => {
  if (isInJest()) return;

  const url = `${BASE}/sounds/${sound}.mp3`;
  const audio = new Audio(url);

  // чтобы не ловить Uncaught (in promise) в браузерах с ограничениями автоплея
  void audio.play().catch(() => {});
};
