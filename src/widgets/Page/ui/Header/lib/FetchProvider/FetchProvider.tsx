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

// Keep literal keys in sync with HeaderMenu declarations
const TESTS_KEY = 'Тесты' as const;
const DICTATIONS_KEY = 'Диктанты' as const;
const PARTS_OF_SPEECH_KEY = 'Части речи' as const;
const THEORY_KEY = 'Теория' as const;
const TRAINERS_KEY = 'Тренажеры' as const;

type HeaderMenuExact = typeof headerCategories;
type HeaderMenuMutable = HeaderMenuExact & Record<string, any[]>;

const cloneMenu = (menu: HeaderMenuExact): HeaderMenuMutable => {
  const out: HeaderMenuMutable = {} as HeaderMenuMutable;
  (Object.keys(menu) as Array<keyof HeaderMenuExact>).forEach((k) => {
    out[k] = Array.isArray(menu[k]) ? [...(menu[k] as any[])] : [];
  });
  return out;
};

const mergeUniqueStrings = (bucket: any[], additions: string[]) => {
  const res = [...bucket];
  const have = new Set(
    bucket.filter((x) => typeof x === 'string').map((s: string) => s.toLowerCase()),
  );
  for (const s of additions) {
    const key = String(s).toLowerCase();
    if (!have.has(key)) {
      res.push(s);
      have.add(key);
    }
  }
  return res;
};

export const FetchProvider: React.FC<FetchProviderProps> = ({
  children,
  setCategories,
  setCategoriesLoading,
}): React.JSX.Element => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let aborted = false;

    const fetchData = async () => {
      setCategoriesLoading(true);
      try {
        const [testsData, dictantsData, partsOfSpeachData] = await Promise.all([
          getDataForCategory<TestInterface[]>(
            { requestID: 'tests/getAllTests', getRequest: getAllTests },
            dispatch,
          ),
          getDataForCategory<DictantType[]>(
            { requestID: 'dictants/getAllDictants', getRequest: getAllDictants },
            dispatch,
          ),
          getDataForCategory<PartsOfSpeachType[]>(
            { requestID: 'partsOfSpeach/getAllPartsOfSpeach', getRequest: getAllPartsOfSpeach },
            dispatch,
          ),
        ]);

        const base = cloneMenu(headerCategories);

        const dictantsToMenu = (d: DictantType) =>
          d.items.map((it) => ({ subtheme: it.subtheme }));
        base[TESTS_KEY] = mergeUniqueStrings(base[TESTS_KEY] ?? [], testsData.map((t) => t.title));

        const staticDictants = Array.isArray(base[DICTATIONS_KEY]) ? base[DICTATIONS_KEY] : [];
        base[DICTATIONS_KEY] = [
          ...staticDictants,
          ...dictantsData.map((d) => ({
            theme: d.theme,
            items:
              d.items.length > 1
                ? [...dictantsToMenu(d), { subtheme: `Диктант ${d.theme}` }]
                : [...dictantsToMenu(d)],
          })),
        ];

        base[PARTS_OF_SPEECH_KEY] = mergeUniqueStrings(
          base[PARTS_OF_SPEECH_KEY] ?? [],
          partsOfSpeachData.map((p) => p.theme),
        );

        const [catsRes, trainersRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/trainers'),
        ]);
        const catsJson = await catsRes.json();
        const trsJson = await trainersRes.json();

        const categories: Array<{ id: string; name: string; slug: string; position?: number }> =
          (catsJson?.categories || []).map((c: any) => ({
            id: c.id,
            name: String(c.name || '').trim(),
            slug: String(c.slug || '').trim(),
            position: Number.isFinite(c.position) ? c.position : 0,
          }));

        const trainers: Array<{ title: string; slug: string; category_slug: string }> =
          (trsJson?.trainers || []).map((t: any) => ({
            title: String(t.title || '').trim(),
            slug: String(t.slug || '').trim(),
            category_slug: String(t.category_slug || '').trim(),
          }));

        const byCat: Record<string, string[]> = {};
        for (const trainer of trainers) {
          if (!byCat[trainer.category_slug]) byCat[trainer.category_slug] = [];
          if (trainer.title) byCat[trainer.category_slug].push(trainer.title);
        }

        base[TRAINERS_KEY] = mergeUniqueStrings(
          base[TRAINERS_KEY] ?? [],
          (byCat['trainers'] || []).sort(),
        );

        const result: HeaderMenuMutable = {
          [PARTS_OF_SPEECH_KEY]: base[PARTS_OF_SPEECH_KEY],
          [TESTS_KEY]: base[TESTS_KEY],
          [DICTATIONS_KEY]: base[DICTATIONS_KEY],
          [THEORY_KEY]: base[THEORY_KEY],
          [TRAINERS_KEY]: base[TRAINERS_KEY],
        } as HeaderMenuMutable;

        const dynamicCats = categories
          .filter((c) => c.slug && c.slug !== 'trainers')
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        for (const c of dynamicCats) {
          (result as Record<string, any[]>)[c.name] = (byCat[c.slug] || []).sort();
        }

        if (!aborted) setCategories(result as unknown as HeaderMenu);
      } catch (e) {
        console.error('Failed to fetch header menu data:', e);
      } finally {
        if (!aborted) setCategoriesLoading(false);
      }
    };

    fetchData();
    return () => {
      aborted = true;
    };
  }, [dispatch, setCategories, setCategoriesLoading]);

  return <>{children}</>;
};

FetchProvider.displayName = 'FetchProvider';
