import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { SyncStatus } from '../../shared/api';
import { runSync } from './sync';
import { supabaseStore } from './supabase';

const AUTO_SYNC_DELAY_MS = 5_000;
// While Kotoba is open it also checks for the other device's changes this
// often, so answers given on the phone show up without restarting.
const BACKGROUND_SYNC_MS = 2 * 60_000;

export const SyncConfig = z.strictObject({
  url: z
    .string()
    .trim()
    .regex(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/, {
      error: 'The project URL looks like https://abcdefgh.supabase.co',
    })
    .transform((url) => url.replace(/\/$/, '')),
  key: z.string().trim().min(20).max(1000),
});

export const Credentials = z.strictObject({
  email: z.email().max(200),
  password: z.string().min(6).max(200),
});

/** Connects Kotoba to the learner's Supabase project and keeps it in sync. */
export class SyncManager {
  private client: SupabaseClient | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly db: DatabaseSync,
    private readonly onSynced: (downloaded: number) => void = () => {},
  ) {
    this.client = this.makeClient();
  }

  private read(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private write(key: string, value: string | null): void {
    if (value === null) {
      this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  private makeClient(): SupabaseClient | null {
    const saved = this.read('sync_config');
    if (!saved) return null;
    const config = SyncConfig.safeParse(JSON.parse(saved));
    if (!config.success) return null;
    return createClient(config.data.url, config.data.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // The sign-in session is kept in the Kotoba database.
        storage: {
          getItem: (key) => this.read(`sync_auth:${key}`),
          setItem: (key, value) => this.write(`sync_auth:${key}`, value),
          removeItem: (key) => this.write(`sync_auth:${key}`, null),
        },
      },
    });
  }

  configure(input: unknown): Promise<SyncStatus> {
    const config = SyncConfig.parse(input);
    this.db.prepare("DELETE FROM settings WHERE key LIKE 'sync_auth:%'").run();
    this.write('sync_config', JSON.stringify(config));
    this.write('sync_cursor', null);
    this.client = this.makeClient();
    return this.status();
  }

  async status(): Promise<SyncStatus> {
    const saved = this.read('sync_config');
    const config = saved ? SyncConfig.safeParse(JSON.parse(saved)) : null;
    const session = this.client
      ? (await this.client.auth.getSession()).data.session
      : null;
    return {
      url: config?.success ? config.data.url : null,
      email: session?.user.email ?? null,
      lastSync: this.read('sync_last'),
      error: this.lastError,
    };
  }

  private requireClient(): SupabaseClient {
    if (!this.client) throw new Error('Add your Supabase project first.');
    return this.client;
  }

  async signIn(input: unknown): Promise<SyncStatus> {
    const { email, password } = Credentials.parse(input);
    const { error } = await this.requireClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    await this.syncNow();
    return this.status();
  }

  /** Creates the account. Supabase may ask to confirm the email first. */
  async signUp(input: unknown): Promise<SyncStatus & { confirm: boolean }> {
    const { email, password } = Credentials.parse(input);
    const { data, error } = await this.requireClient().auth.signUp({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    if (data.session) await this.syncNow();
    return { ...(await this.status()), confirm: !data.session };
  }

  async signOut(): Promise<SyncStatus> {
    await this.client?.auth.signOut();
    this.write('sync_cursor', null);
    return this.status();
  }

  /** Syncs now. Failures are kept for the status line, not thrown, unless asked. */
  async syncNow(throwOnError = false): Promise<SyncStatus> {
    if (!this.running) {
      this.running = (async () => {
        const client = this.client;
        if (!client || !(await client.auth.getSession()).data.session) return;
        try {
          const result = await runSync(this.db, supabaseStore(client));
          this.lastError = null;
          if (result.downloaded > 0) this.onSynced(result.downloaded);
        } catch (error) {
          this.lastError =
            error instanceof Error ? error.message : String(error);
        }
      })().finally(() => {
        this.running = null;
      });
    }
    await this.running;
    if (throwOnError && this.lastError) throw new Error(this.lastError);
    return this.status();
  }

  /** Keeps syncing in the background while the app is open. */
  startBackgroundSync(): void {
    setInterval(() => void this.syncNow(), BACKGROUND_SYNC_MS);
  }

  /** Syncs a few seconds after a change, so a burst of answers goes up once. */
  schedule(): void {
    if (!this.client) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, AUTO_SYNC_DELAY_MS);
  }
}
