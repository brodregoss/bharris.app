import { DurableObject } from 'cloudflare:workers';

function nowIso() {
  return new Date().toISOString();
}

function one(sql, query, ...binds) {
  const rows = sql.exec(query, ...binds).toArray();
  return rows[0] || null;
}

export class UserStudyDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ready = this.ctx.blockConcurrencyWhile(() => this.ensureSchema());
  }

  ensureSchema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT,
        kind TEXT,
        r2_original_key TEXT,
        content_type TEXT,
        size_bytes INTEGER,
        page_count INTEGER,
        transcript TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS note_pages (
        note_id TEXT NOT NULL,
        page_index INTEGER NOT NULL,
        r2_key TEXT NOT NULL,
        content_type TEXT,
        size_bytes INTEGER,
        PRIMARY KEY (note_id, page_index)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        status TEXT,
        title TEXT,
        setup_json TEXT,
        phase TEXT,
        session_json TEXT,
        note_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        finished_at TEXT
      );
      CREATE TABLE IF NOT EXISTS terms (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sort_index INTEGER,
        term TEXT,
        definition TEXT,
        difficulty INTEGER,
        tier TEXT,
        confidence TEXT,
        depends_on_json TEXT,
        recall_history_json TEXT,
        correct_streak INTEGER,
        seen INTEGER,
        test_result TEXT,
        mastery INTEGER
      );
      CREATE TABLE IF NOT EXISTS panic_summaries (
        session_id TEXT PRIMARY KEY,
        signature TEXT,
        text TEXT,
        generated_at INTEGER
      );
    `);
    return Promise.resolve();
  }

  async ping() {
    await this.ready;
    return {
      ok: true,
      storeId: this.ctx.id.toString(),
    };
  }

  async evacuate() {
    await this.ready;
    await this.ctx.storage.deleteAll();
    return { ok: true };
  }

  metaGet(key) {
    const row = one(this.ctx.storage.sql, 'SELECT value FROM meta WHERE key = ?', key);
    return row?.value || null;
  }

  metaSet(key, value) {
    this.ctx.storage.sql.exec(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }

  async putNote(note) {
    await this.ready;
    const now = nowIso();
    this.ctx.storage.sql.exec(
      `INSERT INTO notes (id, title, kind, r2_original_key, content_type, size_bytes, page_count, transcript, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         kind = excluded.kind,
         r2_original_key = excluded.r2_original_key,
         content_type = excluded.content_type,
         size_bytes = excluded.size_bytes,
         page_count = excluded.page_count,
         transcript = COALESCE(excluded.transcript, notes.transcript),
         updated_at = excluded.updated_at`,
      note.id,
      note.title || 'Your notes',
      note.kind || 'photo',
      note.r2OriginalKey || null,
      note.contentType || 'image/jpeg',
      note.sizeBytes || 0,
      note.pageCount || (note.pages?.length ?? 0),
      note.transcript ?? null,
      note.createdAt || now,
      now,
    );
    if (Array.isArray(note.pages)) {
      this.ctx.storage.sql.exec('DELETE FROM note_pages WHERE note_id = ?', note.id);
      note.pages.forEach((page, index) => {
        this.ctx.storage.sql.exec(
          'INSERT INTO note_pages (note_id, page_index, r2_key, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)',
          note.id,
          page.pageIndex ?? index,
          page.r2Key,
          page.contentType || 'image/jpeg',
          page.sizeBytes || 0,
        );
      });
    }
    return this.getNote(note.id);
  }

  async getNote(id) {
    await this.ready;
    const row = one(this.ctx.storage.sql, 'SELECT * FROM notes WHERE id = ?', id);
    if (!row) return null;
    const pages = this.ctx.storage.sql
      .exec('SELECT * FROM note_pages WHERE note_id = ? ORDER BY page_index', id)
      .toArray();
    return { ...row, pages };
  }

  async listNotes() {
    await this.ready;
    return this.ctx.storage.sql
      .exec('SELECT id, title, kind, page_count, transcript, created_at, updated_at FROM notes ORDER BY updated_at DESC')
      .toArray();
  }

  async deleteNote(id) {
    await this.ready;
    if (!id) return { ok: false };
    this.ctx.storage.sql.exec('DELETE FROM note_pages WHERE note_id = ?', id);
    this.ctx.storage.sql.exec('DELETE FROM notes WHERE id = ?', id);
    return { ok: true };
  }

  async putSession(session) {
    await this.ready;
    if (!session?.id || !Array.isArray(session.terms)) {
      throw new Error('Session needs an id and terms');
    }
    const now = nowIso();
    const title = session.title
      || session.setup?.title
      || session.terms[0]?.term
      || 'Cram';
    const status = session.status || (session.finishedAt ? 'finished' : 'active');
    this.ctx.storage.sql.exec(
      `INSERT INTO sessions (id, status, title, setup_json, phase, session_json, note_id, created_at, updated_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         title = excluded.title,
         setup_json = excluded.setup_json,
         phase = excluded.phase,
         session_json = excluded.session_json,
         note_id = excluded.note_id,
         updated_at = excluded.updated_at,
         finished_at = excluded.finished_at`,
      session.id,
      status,
      title,
      JSON.stringify(session.setup || {}),
      session.phase || '',
      JSON.stringify(session),
      session.noteId || null,
      session.createdAt || now,
      now,
      session.finishedAt ? new Date(session.finishedAt).toISOString() : (status === 'finished' ? now : null),
    );
    this.ctx.storage.sql.exec('DELETE FROM terms WHERE session_id = ?', session.id);
    session.terms.forEach((term, index) => {
      this.ctx.storage.sql.exec(
        `INSERT INTO terms (
          id, session_id, sort_index, term, definition, difficulty, tier, confidence,
          depends_on_json, recall_history_json, correct_streak, seen, test_result, mastery
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        term.id || `${session.id}-${index}`,
        session.id,
        index,
        term.term || '',
        term.definition || '',
        term.difficulty ?? null,
        term.tier || null,
        term.confidence || null,
        JSON.stringify(term.depends_on || []),
        JSON.stringify(term.recallHistory || []),
        term.correctStreak || 0,
        term.seen ? 1 : 0,
        term.testResult == null ? null : String(term.testResult),
        term.mastery ?? null,
      );
    });
    if (status === 'active') this.metaSet('current_session_id', session.id);
    else if (this.metaGet('current_session_id') === session.id) {
      this.ctx.storage.sql.exec('DELETE FROM meta WHERE key = ?', 'current_session_id');
    }
    return this.getSession(session.id);
  }

  hydrateSession(row) {
    if (!row) return null;
    try {
      return JSON.parse(row.session_json);
    } catch {
      return null;
    }
  }

  async getSession(id) {
    await this.ready;
    const row = one(this.ctx.storage.sql, 'SELECT * FROM sessions WHERE id = ?', id);
    return this.hydrateSession(row);
  }

  async getCurrentSession() {
    await this.ready;
    const currentId = this.metaGet('current_session_id');
    if (currentId) {
      const current = await this.getSession(currentId);
      if (current) return current;
    }
    const row = one(
      this.ctx.storage.sql,
      "SELECT * FROM sessions WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1",
    );
    return this.hydrateSession(row);
  }

  async listSessions() {
    await this.ready;
    return this.ctx.storage.sql
      .exec(
        `SELECT s.id, s.status, s.title, s.phase, s.note_id, s.created_at, s.updated_at, s.finished_at,
                (SELECT COUNT(*) FROM terms t WHERE t.session_id = s.id) AS term_count
         FROM sessions s
         ORDER BY COALESCE(s.finished_at, s.updated_at) DESC`,
      )
      .toArray();
  }

  async listFinishedSessions() {
    await this.ready;
    return this.ctx.storage.sql
      .exec(
        `SELECT s.id, s.status, s.title, s.phase, s.note_id, s.created_at, s.updated_at, s.finished_at,
                (SELECT COUNT(*) FROM terms t WHERE t.session_id = s.id) AS term_count
         FROM sessions s
         WHERE s.status = 'finished' OR s.finished_at IS NOT NULL
         ORDER BY COALESCE(s.finished_at, s.updated_at) DESC`,
      )
      .toArray();
  }

  async deleteSession(id) {
    await this.ready;
    if (!id) return { ok: false };
    this.ctx.storage.sql.exec('DELETE FROM terms WHERE session_id = ?', id);
    this.ctx.storage.sql.exec('DELETE FROM panic_summaries WHERE session_id = ?', id);
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE id = ?', id);
    if (this.metaGet('current_session_id') === id) {
      this.ctx.storage.sql.exec('DELETE FROM meta WHERE key = ?', 'current_session_id');
    }
    return { ok: true };
  }

  async trimFinishedSessions(limit) {
    await this.ready;
    const cap = Math.max(0, Number(limit) || 0);
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT id FROM sessions
         WHERE status = 'finished' OR finished_at IS NOT NULL
         ORDER BY COALESCE(finished_at, updated_at) DESC`,
      )
      .toArray();
    const extra = rows.slice(cap);
    extra.forEach((row) => {
      this.ctx.storage.sql.exec('DELETE FROM terms WHERE session_id = ?', row.id);
      this.ctx.storage.sql.exec('DELETE FROM panic_summaries WHERE session_id = ?', row.id);
      this.ctx.storage.sql.exec('DELETE FROM sessions WHERE id = ?', row.id);
    });
    return { kept: Math.min(rows.length, cap), removed: extra.length };
  }

  async putPanic(record) {
    await this.ready;
    this.ctx.storage.sql.exec(
      `INSERT INTO panic_summaries (session_id, signature, text, generated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         signature = excluded.signature,
         text = excluded.text,
         generated_at = excluded.generated_at`,
      record.sessionId,
      record.signature || '',
      record.text || '',
      record.generatedAt || Date.now(),
    );
    return record;
  }

  async getPanic(sessionId) {
    await this.ready;
    return one(this.ctx.storage.sql, 'SELECT * FROM panic_summaries WHERE session_id = ?', sessionId);
  }
}
