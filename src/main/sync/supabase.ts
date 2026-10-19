import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncedAttempt } from '../database';
import type { Changes, RemoteStore, SyncedSettings, SyncedTest } from './sync';

const PAGE = 1000;
const CHUNK = 500;
// Rows written while another device was pulling can carry a slightly older
// time; looking back a minute catches them. Applying a row twice is harmless.
const OVERLAP_MS = 60_000;
// Skin pictures go in this private bucket, one folder per user.
const BUCKET = 'kotoba-pictures';
const PICTURE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function pullTable<T>(
  client: SupabaseClient,
  table: string,
  since: string | null,
): Promise<{ rows: T[]; newest: string | null }> {
  const rows: T[] = [];
  let newest: string | null = null;
  for (let from = 0; ; from += PAGE) {
    let query = client
      .from(table)
      .select('data, updated_at')
      .order('updated_at')
      .range(from, from + PAGE - 1);
    if (since) query = query.gt('updated_at', since);
    const page = check(await query) as { data: T; updated_at: string }[];
    for (const row of page) {
      rows.push(row.data);
      newest = row.updated_at;
    }
    if (page.length < PAGE) break;
  }
  return { rows, newest };
}

async function pictureFolder(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('Sign in to sync the picture.');
  return data.session.user.id;
}

/** The shared copy kept in the learner's own Supabase project. */
export function supabaseStore(client: SupabaseClient): RemoteStore {
  return {
    async push(changes: Changes) {
      for (let i = 0; i < changes.attempts.length; i += CHUNK) {
        check(
          await client.from('kotoba_attempts').upsert(
            changes.attempts
              .slice(i, i + CHUNK)
              .map((attempt) => ({ uid: attempt.uid, data: attempt })),
            { onConflict: 'user_id,uid' },
          ),
        );
      }
      for (let i = 0; i < changes.tests.length; i += CHUNK) {
        check(
          await client.from('kotoba_tests').upsert(
            changes.tests
              .slice(i, i + CHUNK)
              .map((test) => ({ test_id: test.test_id, data: test })),
            { onConflict: 'user_id,test_id' },
          ),
        );
      }
      if (changes.settings) {
        check(
          await client
            .from('kotoba_settings')
            .upsert({ data: changes.settings }, { onConflict: 'user_id' }),
        );
      }
    },

    async pull(cursor) {
      const since = cursor
        ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString()
        : null;
      const attempts = await pullTable<SyncedAttempt>(
        client,
        'kotoba_attempts',
        since,
      );
      const tests = await pullTable<SyncedTest>(client, 'kotoba_tests', since);
      const settings = await pullTable<SyncedSettings>(
        client,
        'kotoba_settings',
        since,
      );
      const newest = [attempts.newest, tests.newest, settings.newest, cursor]
        .filter((at): at is string => Boolean(at))
        .sort((a, b) => Date.parse(a) - Date.parse(b))
        .at(-1);
      return {
        changes: {
          attempts: attempts.rows,
          tests: tests.rows,
          settings: settings.rows.at(-1) ?? null,
        },
        cursor: newest ?? new Date(0).toISOString(),
      };
    },

    async uploadPicture(name, bytes) {
      const folder = await pictureFolder(client);
      const storage = client.storage.from(BUCKET);
      check(
        await storage.upload(`${folder}/${name}`, bytes, {
          contentType: PICTURE_TYPES[name.split('.').pop() ?? ''],
          upsert: true,
        }),
      );
      // Only the newest picture is needed; remove the ones it replaced.
      const files = check(await storage.list(folder)) ?? [];
      const old = files
        .filter((file) => file.name !== name)
        .map((file) => `${folder}/${file.name}`);
      if (old.length > 0) check(await storage.remove(old));
    },

    async downloadPicture(name) {
      const folder = await pictureFolder(client);
      const blob = check(
        await client.storage.from(BUCKET).download(`${folder}/${name}`),
      );
      if (!blob) throw new Error('The picture is missing from storage.');
      return new Uint8Array(await blob.arrayBuffer());
    },
  };
}
