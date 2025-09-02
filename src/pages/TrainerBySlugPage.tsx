// pages/TrainerBySlugPage.tsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page } from '@/widgets/Page';
import { TrainerPage } from './TrainerPage'; 

// Если у тебя этот тип где-то уже объявлен — импортни его и удали "any".
type WordsForTrainersItem = {
  type: 'primary' | 'views' | 'choice';
  items: any[];
};

type ApiTrainer = {
  id: string;
  title: string;
  slug: string;
  type: 'two_choice' | 'views' | string;
  category_slug?: string | null;
  meta?: Record<string, any> | null;
};

type ApiItem = {
  id: string;
  trainer_id: string;
  order_index: number;
  payload: any;   // jsonb
  answer: any;    // two_choice: 'valid'|'invalid', views: строка правильного варианта
  created_at?: string;
};

const TrainerBySlugPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [trainer, setTrainer] = useState<ApiTrainer | null>(null);
  const [items, setItems] = useState<ApiItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setNotFound(false);

      try {
        // 1) тренажёр (meta)
        const trRes = await fetch(`/api/trainers?slug=${encodeURIComponent(slug)}`);
        const trJson = await trRes.json();
        if (!trRes.ok || !trJson?.trainer) {
          if (!cancelled) { setNotFound(true); setLoading(false); }
          return;
        }
        if (cancelled) return;
        setTrainer(trJson.trainer as ApiTrainer);

        // 2) задания
        const itRes = await fetch(`/api/trainers/${encodeURIComponent(slug)}/items`);
        const itJson = await itRes.json();
        if (!itRes.ok) throw new Error(itJson?.error || 'items fetch error');
        if (cancelled) return;
        setItems(itJson.items || []);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [slug]);

  const normalized: WordsForTrainersItem | null = useMemo(() => {
    if (!trainer) return null;

    if (trainer.type === 'two_choice') {
      return {
        type: 'primary',
        items: items
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((i) => ({
            ...i,
            // нормализуем payload в { valid, invalid }
            payload: {
              valid: i?.payload?.valid ?? i?.payload?.left ?? null,
              invalid: i?.payload?.invalid ?? i?.payload?.right ?? null,
            },
            // answer должен быть 'valid' | 'invalid'
            answer:
              i?.answer === 'valid' || i?.answer === 'invalid'
                ? i.answer
                : (i?.answer === (i?.payload?.valid ?? i?.payload?.left) ? 'valid' : 'invalid'),
          })),
      };
    }

    if (trainer.type === 'views') {
      return {
        type: 'views',
        items: items
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((i) => ({
            ...i,
            payload: {
              left:  i?.payload?.left  ?? i?.payload?.valid   ?? null,
              right: i?.payload?.right ?? i?.payload?.invalid ?? null,
            },
            // строка правильного варианта
            answer: typeof i?.answer === 'string' ? i.answer : null,
          })),
      };
    }

    return { type: 'primary', items: [] };
  }, [trainer, items]);

  if (loading) {
    return (
      <Page withMarginTop>
        <div style={{ opacity: 0.7 }}>Загрузка…</div>
      </Page>
    );
  }

  if (notFound || !trainer) {
    return (
      <Page withMarginTop>
        <div>Страница не существует!</div>
      </Page>
    );
  }

  if (!normalized) {
    return (
      <Page withMarginTop>
        <div>Данные тренажёра не найдены</div>
      </Page>
    );
  }

  return (
    <TrainerPage
      theme={trainer.title}
      words={normalized as any}
    />
  );
};

export default TrainerBySlugPage;
