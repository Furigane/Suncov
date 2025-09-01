/**
 * Seed script: migrates JSON files from server/data/*.json into Supabase tables.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE in server/.env
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { read } = require('./db');
const { getSupabase } = require('./supabase');

async function main() {
  const sb = getSupabase();

  const categories = read('categories');
  const trainers = read('trainers');
  const items = read('trainer_items');
  const materials = read('materials');

  console.log('[seed] inserting categories:', categories.length);
  for (const c of categories) {
    await sb.from('categories').upsert(
      {
        id: c.id,
        name: c.name,
        slug: c.slug,
        parent_id: c.parentId || null,
        position: c.position || 0,
      },
      { onConflict: 'id' },
    );
  }

  console.log('[seed] inserting trainers:', trainers.length);
  for (const t of trainers) {
    await sb.from('trainers').upsert(
      {
        id: t.id,
        title: t.title,
        slug: t.slug,
        category_slug: t.categorySlug || null,
        type: t.type || 'custom',
        meta: t.meta || {},
        created_at: t.createdAt || null,
      },
      { onConflict: 'id' },
    );
  }

  console.log('[seed] inserting trainer_items:', items.length);
  for (const it of items) {
    await sb.from('trainer_items').upsert(
      {
        id: it.id,
        trainer_id: it.trainerId,
        order_index: it.orderIndex || 0,
        payload: it.payload || {},
        answer: it.answer || null,
        correct_answers: it.correctAnswers || [],
        wrong_answers: it.wrongAnswers || [],
      },
      { onConflict: 'id' },
    );
  }

  console.log('[seed] inserting materials:', materials.length);
  for (const m of materials) {
    await sb.from('materials').upsert(
      {
        id: m.id,
        type: m.type,
        title: m.title,
        slug: m.slug,
        category_slug: m.categorySlug || null,
        content: m.content || {},
        created_at: m.createdAt || null,
      },
      { onConflict: 'id' },
    );
  }

  console.log('[seed] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
