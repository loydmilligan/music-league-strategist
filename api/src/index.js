import express from 'express'
import cors from 'cors'
import pg from 'pg'
import crypto from 'crypto'

const { Pool } = pg

// Helper to generate UUID
function generateUUID() {
  return crypto.randomUUID()
}

// Helper to check if a string is a valid UUID
function isValidUUID(str) {
  if (!str) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Helper to transform song from database (snake_case) to frontend (camelCase)
function transformSong(dbSong, currentTier) {
  if (!dbSong) return null
  return {
    id: dbSong.id,
    title: dbSong.title,
    artist: dbSong.artist,
    album: dbSong.album,
    year: dbSong.year,
    genre: dbSong.genre,
    reason: dbSong.reason,
    question: dbSong.question,
    youtubeVideoId: dbSong.youtube_video_id,
    youtubeUrl: dbSong.youtube_url,
    spotifyTrackId: dbSong.spotify_track_id,
    spotifyUri: dbSong.spotify_uri,
    isFavorite: dbSong.is_favorite,
    isEliminated: dbSong.is_eliminated,
    isMuted: dbSong.is_muted,
    userNotes: dbSong.user_notes,
    ratings: dbSong.ratings,
    aiDescription: dbSong.ai_description,
    promotionHistory: dbSong.promotion_history || [],
    currentTier,
  }
}

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mlstrategist',
  user: process.env.DB_USER || 'mlstrategist',
  password: process.env.DB_PASSWORD || 'mlstrategist',
})

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// API routes are served at /api/ml (reverse-proxied in nginx and Vite)
const api = express.Router()
app.use('/api/ml', api)

// Health check
api.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Initialize database schema
async function initDatabase() {
  const client = await pool.connect()
  try {
    // Check if we need to migrate from UUID to TEXT schema
    const schemaCheck = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'themes' AND column_name = 'id'
    `)

    const needsSchemaMigration = schemaCheck.rows.length > 0 && schemaCheck.rows[0].data_type === 'uuid'

    if (needsSchemaMigration) {
      console.log('Migrating database schema from UUID to TEXT IDs...')
      await client.query(`
        DROP TABLE IF EXISTS conversation_history CASCADE;
        DROP TABLE IF EXISTS session_songs CASCADE;
        DROP TABLE IF EXISTS session_preferences CASCADE;
        DROP TABLE IF EXISTS rejected_songs CASCADE;
        DROP TABLE IF EXISTS theme_songs CASCADE;
        DROP TABLE IF EXISTS saved_songs CASCADE;
        DROP TABLE IF EXISTS long_term_preferences CASCADE;
        DROP TABLE IF EXISTS sessions CASCADE;
        DROP TABLE IF EXISTS songs CASCADE;
        DROP TABLE IF EXISTS themes CASCADE;
        DROP TABLE IF EXISTS user_profile CASCADE;
        DROP TABLE IF EXISTS competitor_analysis CASCADE;
        DROP TABLE IF EXISTS settings CASCADE;
        DROP TABLE IF EXISTS ai_models CASCADE;
      `)
      console.log('Old tables dropped, creating new schema...')
    }

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      -- Themes table (using TEXT for IDs to support frontend-generated IDs)
      CREATE TABLE IF NOT EXISTS themes (
        id TEXT PRIMARY KEY,
        raw_theme TEXT NOT NULL,
        interpretation TEXT,
        strategy TEXT,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        deadline BIGINT,
        phase VARCHAR(20) DEFAULT 'brainstorm',
        hall_passes_used JSONB DEFAULT '{"semifinals": false, "finals": false}',
        spotify_playlist JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Songs table (central song repository)
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        year INTEGER,
        genre VARCHAR(100),
        reason TEXT,
        question TEXT,
        youtube_video_id VARCHAR(100),
        youtube_url TEXT,
        spotify_track_id VARCHAR(100),
        spotify_uri VARCHAR(100),
        is_favorite BOOLEAN DEFAULT false,
        is_eliminated BOOLEAN DEFAULT false,
        is_muted BOOLEAN DEFAULT false,
        user_notes TEXT,
        ratings JSONB,
        ai_description TEXT,
        promotion_history JSONB DEFAULT '[]',
        created_at BIGINT NOT NULL
      );

      -- Theme-Song relationship (tracks which songs are in which theme/tier)
      CREATE TABLE IF NOT EXISTS theme_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        theme_id TEXT REFERENCES themes(id) ON DELETE CASCADE,
        song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
        tier VARCHAR(20) NOT NULL,
        rank INTEGER,
        added_at BIGINT NOT NULL,
        UNIQUE(theme_id, song_id)
      );

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        phase VARCHAR(50),
        iteration_count INTEGER DEFAULT 0,
        final_pick_id TEXT,
        playlist_created JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Conversation history
      CREATE TABLE IF NOT EXISTS conversation_history (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );

      -- Session working candidates (songs being considered in a session)
      CREATE TABLE IF NOT EXISTS session_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
        UNIQUE(session_id, song_id)
      );

      -- Rejected songs
      CREATE TABLE IF NOT EXISTS rejected_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        reason TEXT,
        rejected_at BIGINT NOT NULL
      );

      -- Session preferences
      CREATE TABLE IF NOT EXISTS session_preferences (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        confidence VARCHAR(20),
        source VARCHAR(50),
        created_at BIGINT NOT NULL
      );

      -- User profile
      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(50) DEFAULT 'default',
        summary TEXT,
        categories JSONB DEFAULT '{}',
        evidence_count INTEGER DEFAULT 0,
        weight REAL DEFAULT 0.5,
        updated_at BIGINT NOT NULL,
        UNIQUE(user_id)
      );

      -- Long-term preferences
      CREATE TABLE IF NOT EXISTS long_term_preferences (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(50) DEFAULT 'default',
        statement TEXT NOT NULL,
        specificity VARCHAR(20),
        weight REAL DEFAULT 0.5,
        created_at BIGINT NOT NULL
      );

      -- Saved songs (Songs I Like collection)
      CREATE TABLE IF NOT EXISTS saved_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
        tags TEXT[],
        notes TEXT,
        source_theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
        saved_at BIGINT NOT NULL
      );

      -- Competitor analysis
      CREATE TABLE IF NOT EXISTS competitor_analysis (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(50) DEFAULT 'default',
        league_name VARCHAR(255),
        data JSONB NOT NULL,
        imported_at BIGINT NOT NULL,
        UNIQUE(user_id)
      );

      -- Settings
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(50) DEFAULT 'default',
        settings JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT NOT NULL,
        UNIQUE(user_id)
      );

      -- AI models
      CREATE TABLE IF NOT EXISTS ai_models (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        model_id VARCHAR(255) UNIQUE NOT NULL,
        nickname VARCHAR(100),
        description TEXT,
        tags TEXT[],
        favorite BOOLEAN DEFAULT false,
        model_type VARCHAR(50),
        context_length INTEGER,
        pricing JSONB,
        sort_order INTEGER DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_theme_songs_theme ON theme_songs(theme_id);
      CREATE INDEX IF NOT EXISTS idx_theme_songs_tier ON theme_songs(tier);
      CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_timestamp ON conversation_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_theme ON sessions(theme_id);
      CREATE INDEX IF NOT EXISTS idx_saved_songs_song ON saved_songs(song_id);
      CREATE INDEX IF NOT EXISTS idx_ai_models_model_id ON ai_models(model_id);
    `)

    console.log('Database schema initialized')
  } finally {
    client.release()
  }
}

// ============================================================================
// THEMES API
// ============================================================================

// Get all themes (with song counts)
api.get('/themes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
        COALESCE(json_agg(
          json_build_object(
            'song', row_to_json(s),
            'tier', ts.tier,
            'rank', ts.rank,
            'added_at', ts.added_at
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]') as songs
      FROM themes t
      LEFT JOIN theme_songs ts ON t.id = ts.theme_id
      LEFT JOIN songs s ON ts.song_id = s.id
      GROUP BY t.id
      ORDER BY t.updated_at DESC
    `)

    // Transform to frontend format
    const themes = result.rows.map(row => {
      const songs = row.songs || []
      return {
        id: row.id,
        rawTheme: row.raw_theme,
        interpretation: row.interpretation,
        strategy: row.strategy,
        title: row.title,
        status: row.status,
        deadline: row.deadline,
        phase: row.phase,
        hallPassesUsed: row.hall_passes_used,
        spotifyPlaylist: row.spotify_playlist,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        candidates: songs.filter(s => s.tier === 'candidates' && s.song).map(s => transformSong(s.song, 'candidates')).filter(Boolean),
        semifinalists: songs.filter(s => s.tier === 'semifinalists' && s.song).map(s => transformSong(s.song, 'semifinalists')).filter(Boolean),
        finalists: songs.filter(s => s.tier === 'finalists' && s.song).map(s => transformSong(s.song, 'finalists')).filter(Boolean),
        pick: transformSong(songs.find(s => s.tier === 'pick')?.song, 'pick'),
      }
    })

    res.json(themes)
  } catch (error) {
    console.error('Error fetching themes:', error)
    res.status(500).json({ error: 'Failed to fetch themes' })
  }
})

// Get single theme with all songs
api.get('/themes/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT t.*,
        COALESCE(json_agg(
          json_build_object(
            'song', row_to_json(s),
            'tier', ts.tier,
            'rank', ts.rank,
            'added_at', ts.added_at
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]') as songs
      FROM themes t
      LEFT JOIN theme_songs ts ON t.id = ts.theme_id
      LEFT JOIN songs s ON ts.song_id = s.id
      WHERE t.id = $1
      GROUP BY t.id
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Theme not found' })
    }

    const row = result.rows[0]
    const songs = row.songs || []

    const theme = {
      id: row.id,
      rawTheme: row.raw_theme,
      interpretation: row.interpretation,
      strategy: row.strategy,
      title: row.title,
      status: row.status,
      deadline: row.deadline,
      phase: row.phase,
      hallPassesUsed: row.hall_passes_used,
      spotifyPlaylist: row.spotify_playlist,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      candidates: songs.filter(s => s.tier === 'candidates' && s.song).map(s => transformSong(s.song, 'candidates')).filter(Boolean),
      semifinalists: songs.filter(s => s.tier === 'semifinalists' && s.song).map(s => transformSong(s.song, 'semifinalists')).filter(Boolean),
      finalists: songs.filter(s => s.tier === 'finalists' && s.song).map(s => transformSong(s.song, 'finalists')).filter(Boolean),
      pick: transformSong(songs.find(s => s.tier === 'pick')?.song, 'pick'),
    }

    res.json(theme)
  } catch (error) {
    console.error('Error fetching theme:', error)
    res.status(500).json({ error: 'Failed to fetch theme' })
  }
})

// Create theme
api.post('/themes', async (req, res) => {
  try {
    const { id, rawTheme, title, interpretation, strategy, status, deadline, phase, hallPassesUsed, spotifyPlaylist, createdAt, updatedAt } = req.body
    const now = Date.now()
    const themeId = id || generateUUID()

    const result = await pool.query(`
      INSERT INTO themes (id, raw_theme, title, interpretation, strategy, status, deadline, phase, hall_passes_used, spotify_playlist, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        raw_theme = EXCLUDED.raw_theme,
        title = EXCLUDED.title,
        interpretation = EXCLUDED.interpretation,
        strategy = EXCLUDED.strategy,
        status = EXCLUDED.status,
        deadline = EXCLUDED.deadline,
        phase = EXCLUDED.phase,
        hall_passes_used = EXCLUDED.hall_passes_used,
        spotify_playlist = EXCLUDED.spotify_playlist,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `, [themeId, rawTheme, title, interpretation, strategy, status || 'active', deadline, phase || 'brainstorm', hallPassesUsed || { semifinals: false, finals: false }, spotifyPlaylist, createdAt || now, updatedAt || now])

    const row = result.rows[0]
    res.status(201).json({
      id: row.id,
      rawTheme: row.raw_theme,
      interpretation: row.interpretation,
      strategy: row.strategy,
      title: row.title,
      status: row.status,
      deadline: row.deadline,
      phase: row.phase,
      hallPassesUsed: row.hall_passes_used,
      spotifyPlaylist: row.spotify_playlist,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      candidates: [],
      semifinalists: [],
      finalists: [],
      pick: null,
    })
  } catch (error) {
    console.error('Error creating theme:', error)
    res.status(500).json({ error: 'Failed to create theme' })
  }
})

// Update theme
api.put('/themes/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { rawTheme, title, interpretation, strategy, status, deadline, phase, hallPassesUsed, spotifyPlaylist } = req.body
    const now = Date.now()

    const result = await pool.query(`
      UPDATE themes
      SET raw_theme = COALESCE($1, raw_theme),
          title = COALESCE($2, title),
          interpretation = COALESCE($3, interpretation),
          strategy = COALESCE($4, strategy),
          status = COALESCE($5, status),
          deadline = $6,
          phase = COALESCE($7, phase),
          hall_passes_used = COALESCE($8, hall_passes_used),
          spotify_playlist = COALESCE($9, spotify_playlist),
          updated_at = $10
      WHERE id = $11
      RETURNING *
    `, [rawTheme, title, interpretation, strategy, status, deadline, phase, hallPassesUsed, spotifyPlaylist, now, id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Theme not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating theme:', error)
    res.status(500).json({ error: 'Failed to update theme' })
  }
})

// Delete theme
api.delete('/themes/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM themes WHERE id = $1', [id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting theme:', error)
    res.status(500).json({ error: 'Failed to delete theme' })
  }
})

// ============================================================================
// SONGS API (within themes)
// ============================================================================

// Add song to theme
api.post('/themes/:themeId/songs', async (req, res) => {
  const client = await pool.connect()
  try {
    const { themeId } = req.params
    const { song, tier } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Insert or update song (use frontend ID directly, generate UUID only if missing)
    const songId = song.id || generateUUID()
    const songResult = await client.query(`
      INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, is_favorite, is_eliminated, is_muted, user_notes, ratings, ai_description, promotion_history, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        album = EXCLUDED.album,
        year = EXCLUDED.year,
        genre = EXCLUDED.genre,
        reason = EXCLUDED.reason,
        question = EXCLUDED.question,
        youtube_video_id = EXCLUDED.youtube_video_id,
        youtube_url = EXCLUDED.youtube_url,
        spotify_track_id = EXCLUDED.spotify_track_id,
        spotify_uri = EXCLUDED.spotify_uri,
        is_favorite = EXCLUDED.is_favorite,
        is_eliminated = EXCLUDED.is_eliminated,
        is_muted = EXCLUDED.is_muted,
        user_notes = EXCLUDED.user_notes,
        ratings = EXCLUDED.ratings,
        ai_description = EXCLUDED.ai_description,
        promotion_history = EXCLUDED.promotion_history
      RETURNING *
    `, [
      songId,
      song.title,
      song.artist,
      song.album,
      song.year,
      song.genre,
      song.reason,
      song.question,
      song.youtubeVideoId,
      song.youtubeUrl,
      song.spotifyTrackId,
      song.spotifyUri,
      song.isFavorite || false,
      song.isEliminated || false,
      song.isMuted || false,
      song.userNotes,
      song.ratings,
      song.aiDescription,
      song.promotionHistory || [],
      now
    ])

    // songId is already defined above, songResult.rows[0].id should be the same

    // Link song to theme with tier
    await client.query(`
      INSERT INTO theme_songs (theme_id, song_id, tier, rank, added_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (theme_id, song_id) DO UPDATE SET
        tier = EXCLUDED.tier,
        rank = EXCLUDED.rank
    `, [themeId, songId, tier, song.rank || 0, now])

    // Update theme timestamp
    await client.query('UPDATE themes SET updated_at = $1 WHERE id = $2', [now, themeId])

    await client.query('COMMIT')

    const row = songResult.rows[0]
    res.status(201).json({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      year: row.year,
      genre: row.genre,
      reason: row.reason,
      question: row.question,
      youtubeVideoId: row.youtube_video_id,
      youtubeUrl: row.youtube_url,
      spotifyTrackId: row.spotify_track_id,
      spotifyUri: row.spotify_uri,
      isFavorite: row.is_favorite,
      isEliminated: row.is_eliminated,
      isMuted: row.is_muted,
      userNotes: row.user_notes,
      ratings: row.ratings,
      aiDescription: row.ai_description,
      promotionHistory: row.promotion_history,
      currentTier: tier,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error adding song to theme:', error)
    res.status(500).json({ error: 'Failed to add song to theme' })
  } finally {
    client.release()
  }
})

// Update song in theme (change tier, mute, etc)
api.put('/themes/:themeId/songs/:songId', async (req, res) => {
  const client = await pool.connect()
  try {
    const { themeId, songId } = req.params
    const { tier, song } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Update song properties if provided
    if (song) {
      await client.query(`
        UPDATE songs SET
          title = COALESCE($1, title),
          artist = COALESCE($2, artist),
          album = COALESCE($3, album),
          year = COALESCE($4, year),
          genre = COALESCE($5, genre),
          reason = COALESCE($6, reason),
          question = COALESCE($7, question),
          youtube_video_id = COALESCE($8, youtube_video_id),
          youtube_url = COALESCE($9, youtube_url),
          spotify_track_id = COALESCE($10, spotify_track_id),
          spotify_uri = COALESCE($11, spotify_uri),
          is_favorite = COALESCE($12, is_favorite),
          is_eliminated = COALESCE($13, is_eliminated),
          is_muted = COALESCE($14, is_muted),
          user_notes = COALESCE($15, user_notes),
          ratings = COALESCE($16, ratings),
          ai_description = COALESCE($17, ai_description),
          promotion_history = COALESCE($18, promotion_history)
        WHERE id = $19
      `, [
        song.title, song.artist, song.album, song.year, song.genre,
        song.reason, song.question, song.youtubeVideoId, song.youtubeUrl,
        song.spotifyTrackId, song.spotifyUri, song.isFavorite, song.isEliminated,
        song.isMuted, song.userNotes, song.ratings, song.aiDescription,
        song.promotionHistory, songId
      ])
    }

    // Update tier if provided
    if (tier) {
      await client.query(`
        UPDATE theme_songs SET tier = $1
        WHERE theme_id = $2 AND song_id = $3
      `, [tier, themeId, songId])
    }

    // Update theme timestamp
    await client.query('UPDATE themes SET updated_at = $1 WHERE id = $2', [now, themeId])

    await client.query('COMMIT')

    // Fetch updated song
    const result = await pool.query('SELECT * FROM songs WHERE id = $1', [songId])
    const row = result.rows[0]

    res.json({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      year: row.year,
      genre: row.genre,
      reason: row.reason,
      question: row.question,
      youtubeVideoId: row.youtube_video_id,
      youtubeUrl: row.youtube_url,
      spotifyTrackId: row.spotify_track_id,
      spotifyUri: row.spotify_uri,
      isFavorite: row.is_favorite,
      isEliminated: row.is_eliminated,
      isMuted: row.is_muted,
      userNotes: row.user_notes,
      ratings: row.ratings,
      aiDescription: row.ai_description,
      promotionHistory: row.promotion_history,
      currentTier: tier,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating song:', error)
    res.status(500).json({ error: 'Failed to update song' })
  } finally {
    client.release()
  }
})

// Remove song from theme
api.delete('/themes/:themeId/songs/:songId', async (req, res) => {
  try {
    const { themeId, songId } = req.params
    await pool.query('DELETE FROM theme_songs WHERE theme_id = $1 AND song_id = $2', [themeId, songId])
    await pool.query('UPDATE themes SET updated_at = $1 WHERE id = $2', [Date.now(), themeId])
    res.status(204).send()
  } catch (error) {
    console.error('Error removing song from theme:', error)
    res.status(500).json({ error: 'Failed to remove song from theme' })
  }
})

// ============================================================================
// SESSIONS API
// ============================================================================

// Get all sessions
api.get('/sessions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        COALESCE(json_agg(
          json_build_object(
            'role', ch.role,
            'content', ch.content,
            'timestamp', ch.timestamp
          ) ORDER BY ch.timestamp
        ) FILTER (WHERE ch.id IS NOT NULL), '[]') as conversation_history
      FROM sessions s
      LEFT JOIN conversation_history ch ON s.id = ch.session_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `)

    const sessions = result.rows.map(row => ({
      id: row.id,
      themeId: row.theme_id,
      title: row.title,
      phase: row.phase,
      iterationCount: row.iteration_count,
      finalPickId: row.final_pick_id,
      playlistCreated: row.playlist_created,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      conversationHistory: row.conversation_history,
    }))

    res.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// Get single session
api.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT s.*,
        COALESCE(json_agg(
          json_build_object(
            'role', ch.role,
            'content', ch.content,
            'timestamp', ch.timestamp
          ) ORDER BY ch.timestamp
        ) FILTER (WHERE ch.id IS NOT NULL), '[]') as conversation_history
      FROM sessions s
      LEFT JOIN conversation_history ch ON s.id = ch.session_id
      WHERE s.id = $1
      GROUP BY s.id
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const row = result.rows[0]
    res.json({
      id: row.id,
      themeId: row.theme_id,
      title: row.title,
      phase: row.phase,
      iterationCount: row.iteration_count,
      finalPickId: row.final_pick_id,
      playlistCreated: row.playlist_created,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      conversationHistory: row.conversation_history,
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    res.status(500).json({ error: 'Failed to fetch session' })
  }
})

// Create session
api.post('/sessions', async (req, res) => {
  try {
    const { id, themeId, title, phase, iterationCount, finalPickId, playlistCreated, createdAt, updatedAt, conversationHistory } = req.body
    const now = Date.now()
    const sessionId = id || generateUUID()

    const result = await pool.query(`
      INSERT INTO sessions (id, theme_id, title, phase, iteration_count, final_pick_id, playlist_created, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        theme_id = EXCLUDED.theme_id,
        title = EXCLUDED.title,
        phase = EXCLUDED.phase,
        iteration_count = EXCLUDED.iteration_count,
        final_pick_id = EXCLUDED.final_pick_id,
        playlist_created = EXCLUDED.playlist_created,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `, [sessionId, themeId, title, phase || 'exploring', iterationCount || 0, finalPickId, playlistCreated, createdAt || now, updatedAt || now])

    // Also insert conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        await pool.query(`
          INSERT INTO conversation_history (session_id, role, content, timestamp)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [sessionId, msg.role, msg.content, msg.timestamp || now])
      }
    }

    const row = result.rows[0]
    res.status(201).json({
      id: row.id,
      themeId: row.theme_id,
      title: row.title,
      phase: row.phase,
      iterationCount: row.iteration_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      conversationHistory: [],
    })
  } catch (error) {
    console.error('Error creating session:', error)
    res.status(500).json({ error: 'Failed to create session' })
  }
})

// Update session
api.put('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { title, phase, iterationCount, finalPickId, playlistCreated } = req.body
    const now = Date.now()

    const result = await pool.query(`
      UPDATE sessions SET
        title = COALESCE($1, title),
        phase = COALESCE($2, phase),
        iteration_count = COALESCE($3, iteration_count),
        final_pick_id = COALESCE($4, final_pick_id),
        playlist_created = COALESCE($5, playlist_created),
        updated_at = $6
      WHERE id = $7
      RETURNING *
    `, [title, phase, iterationCount, finalPickId, playlistCreated, now, id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating session:', error)
    res.status(500).json({ error: 'Failed to update session' })
  }
})

// Delete session
api.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM sessions WHERE id = $1', [id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting session:', error)
    res.status(500).json({ error: 'Failed to delete session' })
  }
})

// Add message to session
api.post('/sessions/:id/messages', async (req, res) => {
  try {
    const { id } = req.params
    const { role, content, timestamp } = req.body

    await pool.query(`
      INSERT INTO conversation_history (session_id, role, content, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [id, role, content, timestamp || Date.now()])

    await pool.query('UPDATE sessions SET updated_at = $1 WHERE id = $2', [Date.now(), id])

    res.status(201).json({ success: true })
  } catch (error) {
    console.error('Error adding message:', error)
    res.status(500).json({ error: 'Failed to add message' })
  }
})

// ============================================================================
// USER PROFILE API
// ============================================================================

// Get user profile
api.get('/profile', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'

    const profileResult = await pool.query(
      'SELECT * FROM user_profile WHERE user_id = $1',
      [userId]
    )

    const prefsResult = await pool.query(
      'SELECT * FROM long_term_preferences WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )

    if (profileResult.rows.length === 0) {
      return res.json({
        summary: '',
        categories: { genres: [], eras: [], moods: [], instrumentation: [], vocals: [], lyrics: [], riskAppetite: [], nostalgia: [], dislikes: [], misc: [] },
        evidenceCount: 0,
        weight: 0.5,
        longTermPreferences: [],
        updatedAt: Date.now(),
      })
    }

    const row = profileResult.rows[0]
    res.json({
      summary: row.summary,
      categories: row.categories,
      evidenceCount: row.evidence_count,
      weight: row.weight,
      longTermPreferences: prefsResult.rows.map(p => ({
        statement: p.statement,
        specificity: p.specificity,
        weight: p.weight,
      })),
      updatedAt: row.updated_at,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// Update user profile
api.put('/profile', async (req, res) => {
  const client = await pool.connect()
  try {
    const userId = req.query.userId || 'default'
    const { summary, categories, evidenceCount, weight, longTermPreferences } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    await client.query(`
      INSERT INTO user_profile (user_id, summary, categories, evidence_count, weight, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        categories = EXCLUDED.categories,
        evidence_count = EXCLUDED.evidence_count,
        weight = EXCLUDED.weight,
        updated_at = EXCLUDED.updated_at
    `, [userId, summary, categories, evidenceCount, weight, now])

    // Update long term preferences
    if (longTermPreferences) {
      await client.query('DELETE FROM long_term_preferences WHERE user_id = $1', [userId])
      for (const pref of longTermPreferences) {
        await client.query(`
          INSERT INTO long_term_preferences (user_id, statement, specificity, weight, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [userId, pref.statement, pref.specificity, pref.weight, now])
      }
    }

    await client.query('COMMIT')
    res.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating profile:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  } finally {
    client.release()
  }
})

// ============================================================================
// SAVED SONGS API (Songs I Like)
// ============================================================================

// Get saved songs
api.get('/saved-songs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ss.*, s.*
      FROM saved_songs ss
      JOIN songs s ON ss.song_id = s.id
      ORDER BY ss.saved_at DESC
    `)

    const songs = result.rows.map(row => ({
      id: row.song_id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      year: row.year,
      genre: row.genre,
      reason: row.reason,
      youtubeVideoId: row.youtube_video_id,
      youtubeUrl: row.youtube_url,
      spotifyTrackId: row.spotify_track_id,
      spotifyUri: row.spotify_uri,
      tags: row.tags,
      notes: row.notes,
      sourceThemeId: row.source_theme_id,
      savedAt: row.saved_at,
    }))

    res.json(songs)
  } catch (error) {
    console.error('Error fetching saved songs:', error)
    res.status(500).json({ error: 'Failed to fetch saved songs' })
  }
})

// Save a song
api.post('/saved-songs', async (req, res) => {
  const client = await pool.connect()
  try {
    const { song, tags, notes, sourceThemeId } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Insert or update song (use frontend ID directly)
    const songId = song.id || generateUUID()
    const songResult = await client.query(`
      INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist
      RETURNING id
    `, [
      songId,
      song.title, song.artist, song.album, song.year, song.genre,
      song.reason, song.question, song.youtubeVideoId, song.youtubeUrl,
      song.spotifyTrackId, song.spotifyUri, now
    ])

    // songId is already defined above

    // Save the song
    await client.query(`
      INSERT INTO saved_songs (song_id, tags, notes, source_theme_id, saved_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [songId, tags || [], notes, sourceThemeId, now])

    await client.query('COMMIT')

    res.status(201).json({ success: true, songId })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error saving song:', error)
    res.status(500).json({ error: 'Failed to save song' })
  } finally {
    client.release()
  }
})

// Remove saved song
api.delete('/saved-songs/:songId', async (req, res) => {
  try {
    const { songId } = req.params
    await pool.query('DELETE FROM saved_songs WHERE song_id = $1', [songId])
    res.status(204).send()
  } catch (error) {
    console.error('Error removing saved song:', error)
    res.status(500).json({ error: 'Failed to remove saved song' })
  }
})

// ============================================================================
// COMPETITOR ANALYSIS API
// ============================================================================

// Get competitor analysis
api.get('/competitor-analysis', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const result = await pool.query(
      'SELECT * FROM competitor_analysis WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json(null)
    }

    const row = result.rows[0]
    // Return data in the expected flat structure (rounds, competitors, roundResults at top level)
    res.json({
      leagueName: row.league_name,
      rounds: row.data?.rounds || [],
      competitors: row.data?.competitors || [],
      roundResults: row.data?.roundResults || [],
      importedAt: row.data?.importedAt || Number(row.imported_at),
    })
  } catch (error) {
    console.error('Error fetching competitor analysis:', error)
    res.status(500).json({ error: 'Failed to fetch competitor analysis' })
  }
})

// Import competitor analysis
api.post('/competitor-analysis', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const { leagueName, data } = req.body
    const now = Date.now()

    await pool.query(`
      INSERT INTO competitor_analysis (user_id, league_name, data, imported_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        league_name = EXCLUDED.league_name,
        data = EXCLUDED.data,
        imported_at = EXCLUDED.imported_at
    `, [userId, leagueName, data, now])

    res.status(201).json({ success: true })
  } catch (error) {
    console.error('Error importing competitor analysis:', error)
    res.status(500).json({ error: 'Failed to import competitor analysis' })
  }
})

// ============================================================================
// SETTINGS API
// ============================================================================

// Get settings
api.get('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const result = await pool.query(
      'SELECT * FROM settings WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json({
        openRouterKey: '',
        defaultModel: '',
        spotify: { clientId: '', clientSecret: '', refreshToken: '' },
        youtubeMusic: { clientId: '', clientSecret: '', refreshToken: '' },
        ntfy: { enabled: false, topic: '', serverUrl: 'https://ntfy.sh' },
      })
    }

    res.json(result.rows[0].settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// Update settings
api.put('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const settings = req.body
    const now = Date.now()

    await pool.query(`
      INSERT INTO settings (user_id, settings, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = EXCLUDED.updated_at
    `, [userId, settings, now])

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

// Patch settings (partial update)
api.patch('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const updates = req.body
    const now = Date.now()

    // Get current settings
    const current = await pool.query(
      'SELECT settings FROM settings WHERE user_id = $1',
      [userId]
    )

    const currentSettings = current.rows.length > 0 ? current.rows[0].settings : {}
    const newSettings = { ...currentSettings, ...updates }

    await pool.query(`
      INSERT INTO settings (user_id, settings, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = EXCLUDED.updated_at
    `, [userId, newSettings, now])

    res.json(newSettings)
  } catch (error) {
    console.error('Error patching settings:', error)
    res.status(500).json({ error: 'Failed to patch settings' })
  }
})

// ============================================================================
// AI MODELS API
// ============================================================================

// Get all models
api.get('/models', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_models ORDER BY favorite DESC, sort_order ASC, created_at DESC'
    )

    const models = result.rows.map(row => ({
      id: row.id,
      modelId: row.model_id,
      nickname: row.nickname,
      description: row.description,
      tags: row.tags,
      favorite: row.favorite,
      modelType: row.model_type,
      contextLength: row.context_length,
      pricing: row.pricing,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    res.json(models)
  } catch (error) {
    console.error('Error fetching models:', error)
    res.status(500).json({ error: 'Failed to fetch models' })
  }
})

// Create model
api.post('/models', async (req, res) => {
  try {
    const { modelId, nickname, description, tags, favorite, modelType, contextLength, pricing, sortOrder } = req.body
    const now = Date.now()

    const result = await pool.query(`
      INSERT INTO ai_models (model_id, nickname, description, tags, favorite, model_type, context_length, pricing, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [modelId, nickname, description, tags || [], favorite || false, modelType, contextLength, pricing, sortOrder || 0, now, now])

    const row = result.rows[0]
    res.status(201).json({
      id: row.id,
      modelId: row.model_id,
      nickname: row.nickname,
      description: row.description,
      tags: row.tags,
      favorite: row.favorite,
      modelType: row.model_type,
      contextLength: row.context_length,
      pricing: row.pricing,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  } catch (error) {
    console.error('Error creating model:', error)
    res.status(500).json({ error: 'Failed to create model' })
  }
})

// Update model
api.put('/models/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { modelId, nickname, description, tags, favorite, modelType, contextLength, pricing, sortOrder } = req.body
    const now = Date.now()

    const result = await pool.query(`
      UPDATE ai_models SET
        model_id = COALESCE($1, model_id),
        nickname = COALESCE($2, nickname),
        description = COALESCE($3, description),
        tags = COALESCE($4, tags),
        favorite = COALESCE($5, favorite),
        model_type = COALESCE($6, model_type),
        context_length = COALESCE($7, context_length),
        pricing = COALESCE($8, pricing),
        sort_order = COALESCE($9, sort_order),
        updated_at = $10
      WHERE id = $11
      RETURNING *
    `, [modelId, nickname, description, tags, favorite, modelType, contextLength, pricing, sortOrder, now, id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating model:', error)
    res.status(500).json({ error: 'Failed to update model' })
  }
})

// Delete model
api.delete('/models/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM ai_models WHERE id = $1', [id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting model:', error)
    res.status(500).json({ error: 'Failed to delete model' })
  }
})

// ============================================================================
// MIGRATION API (import from localStorage)
// ============================================================================

api.post('/migrate', async (req, res) => {
  const client = await pool.connect()
  try {
    const { themes, sessions, userProfile, songsILike, settings, competitorAnalysis } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Migrate themes and songs
    if (themes && themes.length > 0) {
      for (const theme of themes) {
        // Use existing theme ID (now supports any format, not just UUID)
        const newThemeId = theme.id || generateUUID()

        // Insert theme (ensure JSONB fields are properly formatted)
        const hallPassesUsed = theme.hallPassesUsed ? JSON.stringify(theme.hallPassesUsed) : '{"semifinals": false, "finals": false}'
        const spotifyPlaylist = theme.spotifyPlaylist ? JSON.stringify(theme.spotifyPlaylist) : null

        await client.query(`
          INSERT INTO themes (id, raw_theme, interpretation, strategy, title, status, deadline, phase, hall_passes_used, spotify_playlist, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            raw_theme = EXCLUDED.raw_theme,
            interpretation = EXCLUDED.interpretation,
            strategy = EXCLUDED.strategy,
            title = EXCLUDED.title,
            status = EXCLUDED.status,
            deadline = EXCLUDED.deadline,
            phase = EXCLUDED.phase,
            hall_passes_used = EXCLUDED.hall_passes_used,
            spotify_playlist = EXCLUDED.spotify_playlist,
            updated_at = EXCLUDED.updated_at
        `, [
          newThemeId, theme.rawTheme || '', theme.interpretation || null, theme.strategy || null,
          theme.title || theme.rawTheme?.slice(0, 50) || 'Untitled', theme.status || 'active', theme.deadline || null, theme.phase || 'brainstorm',
          hallPassesUsed, spotifyPlaylist,
          theme.createdAt || now, theme.updatedAt || now
        ])

        // Migrate songs for each tier (generate new UUIDs for non-UUID IDs)
        const songIdMap = new Map() // Map old ID -> new UUID

        const tiers = ['candidates', 'semifinalists', 'finalists']
        for (const tier of tiers) {
          const songs = theme[tier] || []
          for (const song of songs) {
            const newSongId = song.id || generateUUID()
            songIdMap.set(song.id, newSongId)

            // Ensure JSONB fields are properly formatted
            const songRatings = song.ratings ? JSON.stringify(song.ratings) : null
            const songPromotionHistory = song.promotionHistory ? JSON.stringify(song.promotionHistory) : '[]'

            await client.query(`
              INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, is_favorite, is_eliminated, is_muted, user_notes, ratings, ai_description, promotion_history, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
              ON CONFLICT (id) DO NOTHING
            `, [
              newSongId, song.title || '', song.artist || '', song.album || null, song.year || null, song.genre || null,
              song.reason || null, song.question || null, song.youtubeVideoId || null, song.youtubeUrl || null,
              song.spotifyTrackId || null, song.spotifyUri || null, song.isFavorite || false,
              song.isEliminated || false, song.isMuted || false, song.userNotes || null,
              songRatings, song.aiDescription || null, songPromotionHistory, now
            ])

            await client.query(`
              INSERT INTO theme_songs (theme_id, song_id, tier, rank, added_at)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (theme_id, song_id) DO UPDATE SET tier = EXCLUDED.tier
            `, [newThemeId, newSongId, tier, song.rank || 0, now])
          }
        }

        // Migrate pick
        if (theme.pick) {
          const song = theme.pick
          const newSongId = song.id || generateUUID()
          songIdMap.set(song.id, newSongId)

          // Ensure JSONB fields are properly formatted
          const pickRatings = song.ratings ? JSON.stringify(song.ratings) : null
          const pickPromotionHistory = song.promotionHistory ? JSON.stringify(song.promotionHistory) : '[]'

          await client.query(`
            INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, is_favorite, is_eliminated, is_muted, user_notes, ratings, ai_description, promotion_history, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (id) DO NOTHING
          `, [
            newSongId, song.title || '', song.artist || '', song.album || null, song.year || null, song.genre || null,
            song.reason || null, song.question || null, song.youtubeVideoId || null, song.youtubeUrl || null,
            song.spotifyTrackId || null, song.spotifyUri || null, song.isFavorite || false,
            song.isEliminated || false, song.isMuted || false, song.userNotes || null,
            pickRatings, song.aiDescription || null, pickPromotionHistory, now
          ])

          await client.query(`
            INSERT INTO theme_songs (theme_id, song_id, tier, rank, added_at)
            VALUES ($1, $2, 'pick', 0, $3)
            ON CONFLICT (theme_id, song_id) DO UPDATE SET tier = 'pick'
          `, [newThemeId, newSongId, now])
        }
      }
    }

    // Migrate user profile
    if (userProfile) {
      // Ensure JSONB field is properly formatted
      const categories = userProfile.categories ? JSON.stringify(userProfile.categories) : '{}'

      await client.query(`
        INSERT INTO user_profile (user_id, summary, categories, evidence_count, weight, updated_at)
        VALUES ('default', $1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          summary = EXCLUDED.summary,
          categories = EXCLUDED.categories,
          evidence_count = EXCLUDED.evidence_count,
          weight = EXCLUDED.weight,
          updated_at = EXCLUDED.updated_at
      `, [userProfile.summary || '', categories, userProfile.evidenceCount || 0, userProfile.weight || 0.5, now])

      if (userProfile.longTermPreferences) {
        for (const pref of userProfile.longTermPreferences) {
          await client.query(`
            INSERT INTO long_term_preferences (user_id, statement, specificity, weight, created_at)
            VALUES ('default', $1, $2, $3, $4)
          `, [pref.statement, pref.specificity, pref.weight, now])
        }
      }
    }

    // Migrate saved songs
    if (songsILike && songsILike.length > 0) {
      for (const song of songsILike) {
        const newSongId = song.id || generateUUID()

        await client.query(`
          INSERT INTO songs (id, title, artist, album, year, genre, reason, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          newSongId, song.title, song.artist, song.album, song.year, song.genre,
          song.reason, song.youtubeVideoId, song.youtubeUrl,
          song.spotifyTrackId, song.spotifyUri, now
        ])

        await client.query(`
          INSERT INTO saved_songs (song_id, tags, notes, source_theme_id, saved_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [newSongId, song.tags || [], song.notes, song.sourceThemeId, song.savedAt || now])
      }
    }

    // Migrate settings
    if (settings) {
      // Ensure JSONB field is properly formatted
      const settingsJson = typeof settings === 'string' ? settings : JSON.stringify(settings)

      await client.query(`
        INSERT INTO settings (user_id, settings, updated_at)
        VALUES ('default', $1, $2)
        ON CONFLICT (user_id) DO UPDATE SET
          settings = EXCLUDED.settings,
          updated_at = EXCLUDED.updated_at
      `, [settingsJson, now])
    }

    // Migrate competitor analysis
    if (competitorAnalysis) {
      // Ensure JSONB field is properly formatted - store the entire object as data
      const competitorDataJson = typeof competitorAnalysis === 'string' ? competitorAnalysis : JSON.stringify(competitorAnalysis)

      await client.query(`
        INSERT INTO competitor_analysis (user_id, league_name, data, imported_at)
        VALUES ('default', $1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          league_name = EXCLUDED.league_name,
          data = EXCLUDED.data,
          imported_at = EXCLUDED.imported_at
      `, [competitorAnalysis.leagueName || null, competitorDataJson, now])
    }

    await client.query('COMMIT')
    res.json({ success: true, message: 'Migration completed successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error during migration:', error)
    res.status(500).json({ error: 'Migration failed', details: error.message })
  } finally {
    client.release()
  }
})

// Check if database has data (for migration detection)
api.get('/has-data', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM themes')
    res.json({ hasData: parseInt(result.rows[0].count) > 0 })
  } catch (error) {
    console.error('Error checking data:', error)
    res.status(500).json({ error: 'Failed to check data' })
  }
})

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    await initDatabase()
    app.listen(PORT, () => {
      console.log(`Music League API running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
