// CSV Import Service (Feature 8)
// Parses Music League CSV exports and aggregates competitor data

import type {
  RoundInfo,
  CompetitorProfile,
  CompetitorSubmission,
  RoundResults,
  CompetitorAnalysisData,
} from '@/types/musicLeague'

// CSV Row Types (matching Music League export format)
// Using index signature for compatibility with parseCSV generic

interface RoundRow extends Record<string, string> {
  ID: string
  Created: string
  Name: string
  Description: string
  'Playlist URL': string
}

interface SubmissionRow extends Record<string, string> {
  'Spotify URI': string
  Title: string
  Album: string
  'Artist(s)': string
  'Submitter ID': string
  Created: string
  Comment: string
  'Round ID': string
  'Visible To Voters': string
}

interface CompetitorRow extends Record<string, string> {
  ID: string
  Name: string
}

interface VoteRow extends Record<string, string> {
  'Spotify URI': string
  'Voter ID': string
  Created: string
  'Points Assigned': string
  Comment: string
  'Round ID': string
}

// Parse CSV content into array of objects
function parseCSV<T extends Record<string, string>>(csvContent: string): T[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: T[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) continue

    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    rows.push(row as T)
  }

  return rows
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

// Main import function
export function importMusicLeagueData(
  roundsCSV: string,
  submissionsCSV: string,
  competitorsCSV: string,
  votesCSV: string,
  leagueName?: string
): CompetitorAnalysisData {
  // Parse all CSV files
  const roundRows = parseCSV<RoundRow>(roundsCSV)
  const submissionRows = parseCSV<SubmissionRow>(submissionsCSV)
  const competitorRows = parseCSV<CompetitorRow>(competitorsCSV)
  const voteRows = parseCSV<VoteRow>(votesCSV)

  // Build round info lookup
  const roundsMap = new Map<string, RoundInfo>()
  for (const row of roundRows) {
    roundsMap.set(row.ID, {
      id: row.ID,
      name: row.Name,
      description: row.Description || undefined,
      playlistUrl: row['Playlist URL'] || undefined,
      createdAt: row.Created,
    })
  }

  // Build competitor name lookup
  const competitorNames = new Map<string, string>()
  for (const row of competitorRows) {
    competitorNames.set(row.ID, row.Name)
  }

  // Build submission lookup by (roundId, spotifyUri)
  const submissionMap = new Map<string, SubmissionRow>()
  for (const row of submissionRows) {
    const key = `${row['Round ID']}-${row['Spotify URI']}`
    submissionMap.set(key, row)
  }

  // Aggregate points per song per round
  const songPoints = new Map<string, number>()
  for (const vote of voteRows) {
    const key = `${vote['Round ID']}-${vote['Spotify URI']}`
    const points = parseInt(vote['Points Assigned'], 10) || 0
    songPoints.set(key, (songPoints.get(key) || 0) + points)
  }

  // Build round results with rankings
  const roundResults: RoundResults[] = []
  const roundSubmissions = new Map<string, Array<{ uri: string; points: number; submission: SubmissionRow }>>()

  // Group submissions by round
  for (const submission of submissionRows) {
    const roundId = submission['Round ID']
    const key = `${roundId}-${submission['Spotify URI']}`
    const points = songPoints.get(key) || 0

    if (!roundSubmissions.has(roundId)) {
      roundSubmissions.set(roundId, [])
    }
    roundSubmissions.get(roundId)!.push({
      uri: submission['Spotify URI'],
      points,
      submission,
    })
  }

  // Sort and rank each round
  for (const [roundId, submissions] of roundSubmissions) {
    const roundInfo = roundsMap.get(roundId)
    if (!roundInfo) continue

    // Sort by points descending
    submissions.sort((a, b) => b.points - a.points)

    // Assign ranks (handle ties)
    const rankings: RoundResults['rankings'] = []
    let currentRank = 1
    let lastPoints = -1

    for (let i = 0; i < submissions.length; i++) {
      const { uri, points, submission } = submissions[i]

      // Handle ties - same points = same rank
      if (points !== lastPoints) {
        currentRank = i + 1
        lastPoints = points
      }

      rankings.push({
        rank: currentRank,
        spotifyUri: uri,
        title: submission.Title,
        artist: submission['Artist(s)'],
        submitterId: submission['Submitter ID'],
        submitterName: competitorNames.get(submission['Submitter ID']) || 'Unknown',
        totalPoints: points,
        comment: submission.Comment || undefined,
      })
    }

    roundResults.push({
      roundId,
      roundName: roundInfo.name,
      rankings,
    })
  }

  // Build competitor profiles
  const competitorStats = new Map<string, {
    totalPoints: number
    wins: number
    topThrees: number
    submissions: CompetitorSubmission[]
  }>()

  // Initialize all competitors
  for (const competitor of competitorRows) {
    competitorStats.set(competitor.ID, {
      totalPoints: 0,
      wins: 0,
      topThrees: 0,
      submissions: [],
    })
  }

  // Process each round's results
  for (const round of roundResults) {
    for (const ranking of round.rankings) {
      const stats = competitorStats.get(ranking.submitterId)
      if (!stats) continue

      stats.totalPoints += ranking.totalPoints
      if (ranking.rank === 1) stats.wins++
      if (ranking.rank <= 3) stats.topThrees++

      stats.submissions.push({
        spotifyUri: ranking.spotifyUri,
        title: ranking.title,
        artist: ranking.artist,
        submitterId: ranking.submitterId,
        submitterName: ranking.submitterName,
        roundId: round.roundId,
        roundName: round.roundName,
        pointsReceived: ranking.totalPoints,
        rank: ranking.rank,
        comment: ranking.comment,
      })
    }
  }

  // Build final competitor profiles
  const competitors: CompetitorProfile[] = []
  for (const [competitorId, stats] of competitorStats) {
    const name = competitorNames.get(competitorId) || 'Unknown'
    const submissionCount = stats.submissions.length

    competitors.push({
      id: competitorId,
      name,
      submissions: stats.submissions,
      totalPoints: stats.totalPoints,
      averagePoints: submissionCount > 0 ? stats.totalPoints / submissionCount : 0,
      wins: stats.wins,
      topThrees: stats.topThrees,
    })
  }

  // Sort competitors by total points
  competitors.sort((a, b) => b.totalPoints - a.totalPoints)

  // Sort round results by date
  roundResults.sort((a, b) => {
    const aRound = roundsMap.get(a.roundId)
    const bRound = roundsMap.get(b.roundId)
    if (!aRound || !bRound) return 0
    return new Date(bRound.createdAt).getTime() - new Date(aRound.createdAt).getTime()
  })

  return {
    rounds: Array.from(roundsMap.values()),
    competitors,
    roundResults,
    importedAt: Date.now(),
    leagueName,
  }
}

// Validate CSV files have required columns
export function validateCSVFiles(
  roundsCSV: string,
  submissionsCSV: string,
  competitorsCSV: string,
  votesCSV: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check rounds.csv
  const roundHeaders = parseCSVLine(roundsCSV.split('\n')[0] || '')
  const requiredRoundHeaders = ['ID', 'Name']
  for (const header of requiredRoundHeaders) {
    if (!roundHeaders.includes(header)) {
      errors.push(`rounds.csv missing required column: ${header}`)
    }
  }

  // Check submissions.csv
  const submissionHeaders = parseCSVLine(submissionsCSV.split('\n')[0] || '')
  const requiredSubmissionHeaders = ['Spotify URI', 'Title', 'Artist(s)', 'Submitter ID', 'Round ID']
  for (const header of requiredSubmissionHeaders) {
    if (!submissionHeaders.includes(header)) {
      errors.push(`submissions.csv missing required column: ${header}`)
    }
  }

  // Check competitors.csv
  const competitorHeaders = parseCSVLine(competitorsCSV.split('\n')[0] || '')
  const requiredCompetitorHeaders = ['ID', 'Name']
  for (const header of requiredCompetitorHeaders) {
    if (!competitorHeaders.includes(header)) {
      errors.push(`competitors.csv missing required column: ${header}`)
    }
  }

  // Check votes.csv
  const voteHeaders = parseCSVLine(votesCSV.split('\n')[0] || '')
  const requiredVoteHeaders = ['Spotify URI', 'Points Assigned', 'Round ID']
  for (const header of requiredVoteHeaders) {
    if (!voteHeaders.includes(header)) {
      errors.push(`votes.csv missing required column: ${header}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Get top N songs from a specific round
export function getTopSongsForRound(
  data: CompetitorAnalysisData,
  roundId: string,
  topN: number = 3
): RoundResults['rankings'] {
  const round = data.roundResults.find(r => r.roundId === roundId)
  if (!round) return []
  return round.rankings.filter(r => r.rank <= topN)
}

// Get a competitor's submission history
export function getCompetitorHistory(
  data: CompetitorAnalysisData,
  competitorId: string
): CompetitorSubmission[] {
  const competitor = data.competitors.find(c => c.id === competitorId)
  return competitor?.submissions || []
}

// Get songs that consistently perform well (appear in top 3 multiple times)
export function getConsistentWinners(
  data: CompetitorAnalysisData,
  minAppearances: number = 2
): Array<{ artist: string; count: number; avgRank: number }> {
  const artistStats = new Map<string, { totalRank: number; count: number }>()

  for (const round of data.roundResults) {
    const top3 = round.rankings.filter(r => r.rank <= 3)
    for (const ranking of top3) {
      const current = artistStats.get(ranking.artist) || { totalRank: 0, count: 0 }
      current.totalRank += ranking.rank
      current.count++
      artistStats.set(ranking.artist, current)
    }
  }

  const results: Array<{ artist: string; count: number; avgRank: number }> = []
  for (const [artist, stats] of artistStats) {
    if (stats.count >= minAppearances) {
      results.push({
        artist,
        count: stats.count,
        avgRank: stats.totalRank / stats.count,
      })
    }
  }

  return results.sort((a, b) => b.count - a.count || a.avgRank - b.avgRank)
}
