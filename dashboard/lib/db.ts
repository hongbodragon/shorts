import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "../data/db.sqlite");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

export function getCategories() {
  return getDb().prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY id").all();
}

export function getArticlesByCategory(categoryId: number, stage?: string) {
  const q = stage
    ? `SELECT a.*, w.stage, w.is_ab_test, w.channel_id
       FROM articles a
       LEFT JOIN workflow_state w ON w.article_id = a.id
       WHERE a.category_id = ? AND (w.stage = ? OR (w.stage IS NULL AND ? = 'collected'))
       ORDER BY a.collected_at DESC LIMIT 100`
    : `SELECT a.*, w.stage, w.is_ab_test, w.channel_id
       FROM articles a
       LEFT JOIN workflow_state w ON w.article_id = a.id
       WHERE a.category_id = ?
       ORDER BY a.collected_at DESC LIMIT 100`;

  return stage
    ? getDb().prepare(q).all(categoryId, stage, stage)
    : getDb().prepare(q).all(categoryId);
}

export function getArticlesByStage(categoryId: number) {
  const STAGES = [
    "collected", "approved", "scripting", "imaging",
    "subtitling", "preview", "uploading", "monitoring", "done", "trash",
  ];

  const articles = getArticlesByCategory(categoryId);
  const grouped: Record<string, unknown[]> = {};
  for (const s of STAGES) grouped[s] = [];

  for (const a of articles as Record<string, unknown>[]) {
    const stage = (a.stage as string) || "collected";
    if (grouped[stage]) grouped[stage].push(a);
  }
  return grouped;
}

export function updateWorkflowStage(articleId: number, stage: string) {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM workflow_state WHERE article_id = ?")
    .get(articleId);
  if (existing) {
    db.prepare(
      "UPDATE workflow_state SET stage = ?, updated_at = datetime('now','localtime') WHERE article_id = ?"
    ).run(stage, articleId);
  } else {
    db.prepare(
      "INSERT INTO workflow_state (article_id, stage) VALUES (?, ?)"
    ).run(articleId, stage);
  }
}

export function getApiKeys(serviceName?: string) {
  const q = serviceName
    ? "SELECT id, service_name, key_label, api_key, extra, is_active, last_used_at, error_count FROM api_keys WHERE service_name = ? ORDER BY id"
    : "SELECT id, service_name, key_label, api_key, extra, is_active, last_used_at, error_count FROM api_keys ORDER BY service_name, id";
  return serviceName ? getDb().prepare(q).all(serviceName) : getDb().prepare(q).all();
}

export function getAiSettings(channelId?: number) {
  return getDb()
    .prepare(
      "SELECT * FROM ai_settings WHERE channel_id IS ? OR channel_id IS NULL ORDER BY channel_id DESC NULLS LAST LIMIT 1"
    )
    .get(channelId ?? null);
}

export function addApiKey(serviceName: string, apiKey: string, label: string, extra?: string) {
  return getDb()
    .prepare("INSERT INTO api_keys (service_name, api_key, key_label, extra) VALUES (?, ?, ?, ?)")
    .run(serviceName, apiKey, label, extra ?? null);
}

export function updateApiKey(id: number, fields: { key_label?: string; api_key?: string; extra?: string; is_active?: boolean }) {
  const db = getDb();
  if (fields.key_label !== undefined)
    db.prepare("UPDATE api_keys SET key_label = ? WHERE id = ?").run(fields.key_label, id);
  if (fields.api_key !== undefined)
    db.prepare("UPDATE api_keys SET api_key = ? WHERE id = ?").run(fields.api_key, id);
  if (fields.extra !== undefined)
    db.prepare("UPDATE api_keys SET extra = ? WHERE id = ?").run(fields.extra, id);
  if (fields.is_active !== undefined)
    db.prepare("UPDATE api_keys SET is_active = ? WHERE id = ?").run(fields.is_active ? 1 : 0, id);
}

export function toggleApiKey(id: number, isActive: boolean) {
  return getDb()
    .prepare("UPDATE api_keys SET is_active = ? WHERE id = ?")
    .run(isActive ? 1 : 0, id);
}

export function deleteApiKey(id: number) {
  return getDb().prepare("DELETE FROM api_keys WHERE id = ?").run(id);
}

export function getChannels() {
  return getDb()
    .prepare("SELECT id, name, description, youtube_channel_id, country_code, language, is_active, created_at FROM channels ORDER BY id")
    .all();
}

export function addChannel(data: {
  name: string; description: string; youtube_channel_id: string;
  country_code: string; language: string; category_id?: number;
}) {
  return getDb()
    .prepare(
      "INSERT INTO channels (name, description, youtube_channel_id, country_code, language, category_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(data.name, data.description, data.youtube_channel_id, data.country_code, data.language, data.category_id ?? null);
}

export function toggleChannel(id: number, isActive: boolean) {
  return getDb().prepare("UPDATE channels SET is_active = ? WHERE id = ?").run(isActive ? 1 : 0, id);
}

export function upsertAiSettings(settings: {
  channel_id?: number | null;
  script_provider: string; script_model: string;
  image_provider: string; image_model?: string; tts_provider: string;
}) {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM ai_settings WHERE channel_id IS ?")
    .get(settings.channel_id ?? null);
  if (existing) {
    db.prepare(
      `UPDATE ai_settings SET script_provider=?, script_model=?, image_provider=?, image_model=?, tts_provider=?, updated_at=datetime('now','localtime') WHERE channel_id IS ?`
    ).run(settings.script_provider, settings.script_model, settings.image_provider, settings.image_model ?? "", settings.tts_provider, settings.channel_id ?? null);
  } else {
    db.prepare(
      "INSERT INTO ai_settings (channel_id, script_provider, script_model, image_provider, image_model, tts_provider) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(settings.channel_id ?? null, settings.script_provider, settings.script_model, settings.image_provider, settings.image_model ?? "", settings.tts_provider);
  }
}
