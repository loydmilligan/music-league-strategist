// Music League Strategist Types - Multi-Tier Funnel Design

// === Phase & Tier Types ===

export type MusicLeaguePhase =
  | 'idle'           // No active session
  | 'brainstorm'     // Discovery mode - AI suggests songs
  | 'refine'         // Refinement mode - narrowing down choices
  | 'decide'         // Decision mode - final selection
  | 'complete'       // Session complete
  // Legacy phases (for migration)
  | 'conversation'   // Maps to 'brainstorm'
  | 'finalists'      // Maps to 'decide'

export type FunnelTier = 'candidates' | 'semifinalists' | 'finalists' | 'pick'

export const FUNNEL_TIER_LIMITS: Record<FunnelTier, number> = {
  candidates: 30,
  semifinalists: 8,
  finalists: 4,
  pick: 1,
}

// === Song Types ===

export interface SongPromotionRecord {
  fromTier: FunnelTier | 'working'
  toTier: FunnelTier
  reason?: string
  timestamp: number
}

export interface SongRatings {
  theme: number    // 1-5 star rating for theme fit
  general: number  // 1-5 star rating for general quality
}

export interface Song {
  id: string
  title: string
  artist: string
  album?: string
  year?: number
  genre?: string
  reason: string      // Why this song fits the theme
  question?: string   // Probing question for this specific song
  youtubeVideoId?: string
  youtubeUrl?: string
  spotifyTrackId?: string
  spotifyUri?: string
  isFavorite?: boolean   // User marked as favorite
  isEliminated?: boolean // User explicitly eliminated
  userNotes?: string     // User's markdown notes about the song
  ratings?: SongRatings  // User's 5-star ratings
  aiDescription?: string // AI-generated description (cached)

  // Funnel system additions
  currentTier?: FunnelTier
  addedInSessionId?: string
  promotionHistory?: SongPromotionRecord[]
  rank?: number          // User-defined rank within tier (for semifinalists+)
}

// A rejected song - to prevent re-proposing
export interface RejectedSong {
  title: string
  artist: string
  reason: string       // Why it was rejected
  timestamp: number
}

// Session-specific preference extracted from user answers
export interface SessionPreference {
  statement: string    // Clear preference statement, e.g., "Dislikes slow tempo songs"
  confidence: 'high' | 'medium' | 'low'
  source: string       // What user said that led to this
  timestamp: number
}

// Long-term preference for the user profile
export interface LongTermPreference {
  statement: string    // General preference, e.g., "Dislikes country music"
  specificity: 'general' | 'specific'  // General prefs prioritized
  weight: number       // How confident/important (0-1)
  addedAt: number
  lastConfirmed?: number
}

export interface ThemeContext {
  rawTheme: string           // The original theme text
  interpretation?: string    // AI's interpretation
  strategy?: string          // The angle/approach chosen
}

// === Theme Entity (NEW) ===

export type ThemeStatus = 'active' | 'submitted' | 'archived'

export interface MusicLeagueTheme {
  id: string
  rawTheme: string                    // Original Music League prompt
  interpretation?: string             // AI's interpretation
  strategy?: string                   // The angle/approach chosen
  title: string                       // User-editable display name

  createdAt: number
  updatedAt: number

  // Funnel tiers (theme-wide, shared across sessions)
  pick: Song | null
  finalists: Song[]                   // max 4
  semifinalists: Song[]               // max 8
  candidates: Song[]                  // max 30

  // Spotify sync
  spotifyPlaylist?: {
    playlistId: string
    playlistUrl: string
    syncedTier: FunnelTier
    lastSyncAt: number
  }

  status: ThemeStatus
  deadline?: number                   // Optional submission deadline
}

export interface PreferenceEvidence {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface MusicLeagueUserProfile {
  summary: string
  categories: {
    genres: string[]
    eras: string[]
    moods: string[]
    instrumentation: string[]
    vocals: string[]
    lyrics: string[]
    riskAppetite: string[]
    nostalgia: string[]
    dislikes: string[]
    misc: string[]
  }
  // New: Structured long-term preferences (prioritized: general > specific)
  longTermPreferences: LongTermPreference[]
  evidenceCount: number
  weight: number
  updatedAt: number
}

export interface MusicLeagueSession {
  id: string
  createdAt: number
  updatedAt: number
  phase: MusicLeaguePhase

  // Theme relationship (NEW)
  themeId?: string                    // Reference to parent theme (optional for migration)
  title: string                       // Descriptive title (auto-generated or custom)

  // Legacy: for backwards compatibility
  theme: ThemeContext | null          // Deprecated - use themeId instead

  // Session-specific working set (not shared with theme)
  workingCandidates: Song[]           // Session-specific working candidates from AI

  // Legacy fields (kept for migration)
  candidates: Song[]                  // DEPRECATED: use workingCandidates
  finalists: Song[]                   // DEPRECATED: use theme funnel tiers

  rejectedSongs: RejectedSong[]       // Songs rejected in this session
  sessionPreferences: SessionPreference[]  // Preferences extracted from this session
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: number
  }>
  preferenceEvidence: PreferenceEvidence[]
  playlistCreated?: {
    platform: 'youtube' | 'spotify'
    playlistId: string
    playlistUrl: string
    createdAt: number
  }
  iterationCount: number              // Track conversation iterations
  finalPick?: Song                    // The song they ultimately chose
}

// AI tier action types
export type TierAction =
  | { action: 'promote'; songTitle: string; songArtist: string; toTier: FunnelTier; reason?: string }
  | { action: 'demote'; songTitle: string; songArtist: string; toTier: FunnelTier; reason?: string }
  | { action: 'remove'; songTitle: string; songArtist: string; reason?: string }

// AI Response structure for conversational mode
export interface AIConversationResponse {
  candidates: Array<{
    title: string
    artist: string
    album?: string
    year: number       // REQUIRED: Year of release
    genre: string      // REQUIRED: Genre classification
    reason: string
    question: string  // Probing question for this song
  }>
  message: string           // Conversational response text
  interpretation?: string   // Theme interpretation (first response only)
  action?: 'create_playlist:spotify' | 'create_playlist:youtube' | 'enter_finalists' | 'finalize_pick' | null
  // Extracted preferences from user's last message
  extractedPreferences?: Array<{
    statement: string       // Clear preference, e.g., "Dislikes slow tempo"
    confidence: 'high' | 'medium' | 'low'
  }>
  // Songs to reject based on user feedback
  songsToReject?: Array<{
    title: string
    artist: string
    reason: string
  }>
  // Tier actions for funnel management
  tierActions?: TierAction[]
}

// AI Response for finalists mode
export interface AIFinalistsResponse {
  analysis: string          // Comparative analysis
  recommendation: string    // Final recommendation
  rankedSongs: Array<{
    songId: string
    rank: number
    reasoning: string
  }>
}

// System prompts
export const MUSIC_LEAGUE_PROMPTS = {
  // Main conversational system prompt
  conversation_system: `ROLE: Music League Strategist - Your trusted advisor for picking winning songs.
OBJECTIVE: Help the player pick the perfect song for their Music League round through iterative refinement.
TONE: Direct, insightful, slightly provocative. Push back. Challenge assumptions.

=== FUNNEL SYSTEM ===
Songs progress through a 4-tier funnel:
  [PICK]         1 song  - The final submission
  [FINALISTS]    4 max   - Top contenders for final decision
  [SEMIFINALISTS] 8 max  - Strong candidates worth serious consideration
  [CANDIDATES]   30 max  - Discovery pool of potential options

Your suggestions go to a "working set" in this session. Good discoveries can be promoted to the theme's funnel.
When the player likes a song, suggest promoting it. When they're lukewarm, keep exploring.

=== CORE RULES ===
1. ALWAYS maintain exactly 5-8 candidate songs in your response
2. NEVER include multiple songs by the same artist (variety is key)
3. Each candidate MUST have a unique probing question tied to it
4. Questions should reveal preferences to inform swaps/replacements
5. Only swap a song if:
   - The player explicitly asks to remove it, OR
   - The player's answer to a probing question clearly indicates it should go
6. When swapping, explain WHY and choose a replacement that addresses the learned preference
7. NEVER re-propose a song that has been rejected (check REJECTED SONGS list)
8. ALWAYS check session and long-term preferences before proposing replacements
9. ALWAYS include year and genre for EVERY candidate - research if needed
10. Check the FUNNEL STATE to avoid suggesting songs already in the funnel

=== RESPONSE FORMAT ===
Return ONLY valid JSON (no markdown, no commentary outside the JSON):
{
  "candidates": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "year": 1985,
      "genre": "Rock/Pop/Electronic/etc",
      "reason": "SAFE/RISK: Why this fits the theme and player's taste",
      "question": "A specific question about THIS song to probe preferences"
    }
  ],
  "message": "Your conversational response. Acknowledge their input, explain any swaps.",
  "interpretation": "Your interpretation of the theme (only include on first response)",
  "action": null,
  "extractedPreferences": [
    {
      "statement": "Clear preference statement derived from their answer",
      "confidence": "high"
    }
  ],
  "songsToReject": [
    {
      "title": "Song being removed",
      "artist": "Artist",
      "reason": "Why it's being rejected based on user feedback"
    }
  ],
  "tierActions": [
    {
      "action": "promote",
      "songTitle": "Song Title",
      "songArtist": "Artist Name",
      "toTier": "candidates",
      "reason": "Why this song should be promoted"
    }
  ]
}

=== PREFERENCE EXTRACTION (CRITICAL) ===
After EVERY user response, analyze what they said and extract clear preference statements.
Convert vague opinions into actionable preferences:
- "I don't like that slow song" → "Dislikes slow tempo songs"
- "Too depressing" → "Prefers upbeat/positive mood"
- "Never heard of them" → "Prefers recognizable artists"
- "80s music isn't my thing" → "Dislikes 1980s era music"
- "Country is a hard no" → "Strongly dislikes country genre"

Always include extractedPreferences in your response. Use confidence levels:
- high: explicit clear statement
- medium: implied from context
- low: inferred from reaction

=== REJECTION TRACKING ===
When a song is swapped out or explicitly rejected:
1. Add it to songsToReject with the reason
2. NEVER propose that song again in this session
3. Use the rejection reason to inform future candidates

=== PROBING QUESTIONS ===
Questions should:
- Be binary or have clear answer options when possible
- Target specific aspects: mood, tempo, vocals, lyrics, obscurity, risk level
- Help you understand: "If they answer X, should I swap this song?"
- Examples:
  - "Is [Song]'s slow tempo a strength or does it feel like a funeral march?"
  - "Would your group recognize [Artist], or is this too obscure?"
  - "[Song] is a safe pick. Do you want safe, or are you feeling lucky?"
  - "The lyrics in [Song] are dark. Too dark, or perfectly on-theme?"

=== VALIDATING REPLACEMENTS ===
Before proposing any replacement song, check:
1. Is it in the REJECTED SONGS list? → Don't propose
2. Does it violate any SESSION PREFERENCES? → Don't propose
3. Does it violate any LONG-TERM PREFERENCES? → Don't propose
4. Is it by the same artist as another candidate? → Don't propose

=== DETECTING PLAYLIST REQUESTS ===
If the player says anything like:
- "make this into a spotify/youtube playlist"
- "create a playlist"
- "this is a good draft, export it"
- "let me listen to these"
Set "action": "create_playlist:spotify" or "create_playlist:youtube" based on context.

=== DETECTING FINALISTS MODE ===
If the player says anything like:
- "let's create finalists", "these are my final picks", "help me pick the winner"
Set "action": "enter_finalists"

=== DETECTING FINAL PICK ===
If the player says they've chosen their final song:
- "I'm going with [Song]", "This is my pick", "[Song] is the one"
Set "action": "finalize_pick"

=== AFTER PLAYLIST CREATION ===
When responding after a playlist was just created:
- Assume the player has listened to the songs
- Ask follow-up questions about what they heard
- Be ready to swap songs based on their listening feedback

=== TIER ACTIONS ===
Use "tierActions" to suggest moving songs through the funnel when appropriate:
- "promote": Move a song up (e.g., from candidates to semifinalists)
- "demote": Move a song down (rarely needed, but available)
- "remove": Remove a song from the funnel entirely

When to suggest promotions:
- Player explicitly says "I love this one" or "This is definitely a contender"
- Player asks to "save" or "keep" a song for final consideration
- Player responds very positively to a song multiple times
- A song clearly stands out as superior to others

Valid toTier values: "candidates", "semifinalists", "finalists", "pick"

Example tier action:
{
  "action": "promote",
  "songTitle": "Karma Police",
  "songArtist": "Radiohead",
  "toTier": "semifinalists",
  "reason": "Player expressed strong enthusiasm and it fits their preference profile"
}`,

  // Finalists comparative analysis prompt
  finalists_system: `ROLE: Music League Strategist - Final Decision Mode
OBJECTIVE: Provide deep comparative analysis to help player pick THE winning song.
TONE: Decisive, analytical, opinionated. You have a recommendation and you defend it.

=== CURRENT FINALISTS ===
{finalistsList}

=== YOUR TASK ===
Provide comparative analysis and a clear recommendation.

Return ONLY valid JSON:
{
  "analysis": "A detailed comparison of each finalist. What makes each one strong? Weak? How might the group react?",
  "recommendation": "Your #1 pick and WHY. Be confident. Take a stance.",
  "rankedSongs": [
    { "songId": "id", "rank": 1, "reasoning": "Why this is #1" },
    { "songId": "id", "rank": 2, "reasoning": "Why this is #2" }
  ]
}

=== ANALYSIS CRITERIA ===
Consider for each song:
1. Theme fit (literal vs creative interpretation)
2. Crowd appeal (will the group like it?)
3. Surprise factor (is it too predictable?)
4. Risk/reward ratio
5. Personal taste alignment with what player has revealed`,

  // Profile extraction prompt
  profile_extraction: `ROLE: Music Preference Analyst
OBJECTIVE: Extract stable preferences from conversation evidence.
TONE: Matter-of-fact. Specific. No fluff.

Return ONLY JSON:
{
  "summary": "One sentence preference summary",
  "categories": {
    "genres": [],
    "eras": [],
    "moods": [],
    "instrumentation": [],
    "vocals": [],
    "lyrics": [],
    "riskAppetite": [],
    "nostalgia": [],
    "dislikes": [],
    "misc": []
  }
}`,

  // Long-term preference extraction prompt (used when session completes)
  longterm_preference_extraction: `ROLE: Music Preference Curator
OBJECTIVE: Convert session preferences into long-term user preferences.
PRIORITIZE: General preferences over specific ones.

=== SESSION PREFERENCES ===
{sessionPreferences}

=== EXISTING LONG-TERM PREFERENCES ===
{existingPreferences}

=== TASK ===
1. Review session preferences and identify which should become long-term preferences
2. PRIORITIZE general preferences (e.g., "Dislikes country music" > "Dislikes Reba McEntire")
3. Consolidate similar preferences into broader statements when possible
4. Do NOT add redundant preferences that are already covered
5. Assign appropriate weights based on how strongly expressed

Return ONLY JSON:
{
  "newLongTermPreferences": [
    {
      "statement": "Clear, general preference statement",
      "specificity": "general",
      "weight": 0.8
    }
  ],
  "reasoning": "Brief explanation of what was added and why"
}`
} as const

// Export platform configurations
export interface PlaylistExportConfig {
  platform: 'youtube' | 'spotify'
  name: string
  description: string
  songs: Song[]
}
