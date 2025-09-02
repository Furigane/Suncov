/* eslint-disable ulbi-tv-plugin/layer-imports */
import { useAppDispatch } from '@/shared/store';
import { getAllTests } from '@/pages/TestsPage';
import { useEffect } from 'react';
import { HeaderMenu } from '../../model/types';
import { DictantType, getAllDictants } from '@/pages/DictantsPage';
import { getDataForCategory } from './lib/getDataForCategory';
import { getAllPartsOfSpeach, PartsOfSpeachType } from '@/pages/PartsOfSpeachPage';
import { headerCategories } from '../../model/data';
import { TestInterface } from '@/features/Test';

interface FetchProviderProps {
  children: React.ReactNode;
  setCategories: React.Dispatch<React.SetStateAction<HeaderMenu>>;
  setCategoriesLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

type ApiCategory = { id: string; name: string; slug: string };
type ApiTrainer = { id: string; title: string; slug: string; category_slug?: string | null; type?: string };

export const FetchProvider: React.FC<FetchProviderProps> = ({
  children,
  setCategories,
  setCategoriesLoading,
}) => {
  const dispatch = useAppDispatch();

  // безопасный вызов: не даём всей загрузке упасть из-за одного раздела
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setCategoriesLoading(true);

      try {
        // ---- Старые разделы: берём что получится, иначе []
        const [testsData, dictantsData, partsData] = await Promise.all([
          safe(() =>
            getDataForCategory<TestInterface[]>(
              { requestID: 'tests/getAllTests', getRequest: getAllTests },
              dispatch,
            ),
            [],
          ),
          safe(() =>
            getDataForCategory<DictantType[]>(
              { requestID: 'dictants/getAllDictants', getRequest: getAllDictants },
              dispatch,
            ),
            [],
          ),
          safe(() =>
            getDataForCategory<PartsOfSpeachType[]>(
              { requestID: 'partsOfSpeach/getAllPartsOfSpeach', getRequest: getAllPartsOfSpeach },
              dispatch,
            ),
            [],
          ),
        ]);

        // ---- Тренажёры и категории из нового API
        let trainersMenu: Array<{ theme: string; items: Array<{ subtheme: string; slug: string }> }> = [];
        try {
          const [catsRes, trRes] = await Promise.all([fetch('/api/categories'), fetch('/api/trainers')]);
          const catsJson = await catsRes.json();
          const trJson = await trRes.json();

          const categories: ApiCategory[] = catsJson?.categories ?? [];
          const trainers: ApiTrainer[] = trJson?.trainers ?? [];

          const nameBySlug = new Map(categories.map((c) => [c.slug, c.name]));
          const grouped = new Map<string, Array<{ subtheme: string; slug: string }>>();

          trainers.forEach((t) => {
            const key = t.category_slug ?? '__none__';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push({ subtheme: t.title, slug: t.slug });
          });

          trainersMenu = Array.from(grouped.entries())
            .map(([slug, items]) => ({
              theme: nameBySlug.get(slug) ?? 'Без категории',
              items: items.sort((a, b) => a.subtheme.localeCompare(b.subtheme, 'ru')),
            }))
            .sort((a, b) => a.theme.localeCompare(b.theme, 'ru'));
        } catch (e) {
          console.error('[Header] trainers fetch error:', e);
          trainersMenu = []; // просто без тренажёров, но меню не ломаем
        }

        const dictantItems = (d: DictantType) => d.items.map((i) => ({ subtheme: i.subtheme }));

        if (cancelled) return;

        setCategories((prev) => ({
          ...prev,
          ...headerCategories,

          Тесты: testsData.map((t) => t.title),

          Диктанты: dictantsData.map((d) => ({
            theme: d.theme,
            items: d.items.length > 1
              ? [...dictantItems(d), { subtheme: `Все ${d.theme}` }]
              : [...dictantItems(d)],
          })),

          'Части речи': partsData.map((p) => p.theme),

          // Новое
          Тренажеры: trainersMenu,
        }));
      } catch (err) {
        console.error('Ошибка при загрузке меню:', err);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [dispatch, setCategories, setCategoriesLoading]);

  return <>{children}</>;
};

FetchProvider.displayName = 'FetchProvider';
