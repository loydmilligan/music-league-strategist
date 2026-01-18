# Music League Strategist

AI-powered song discovery for Music League competitions. Get personalized song recommendations, organize candidates through a 4-tier funnel system, and create playlists on Spotify or YouTube Music.

## Features

- **AI-Powered Discovery**: Chat with AI to discover songs that fit your Music League theme
- **4-Tier Funnel System**: Organize songs through Candidates → Semifinalists → Finalists → Pick
- **Cross-Platform Links**: Automatic enrichment with Spotify and YouTube links via Songlink
- **Playlist Creation**: Create playlists directly on Spotify or YouTube Music
- **Song Details**: View metadata, add ratings, notes, and embedded players for each song
- **Theme & Session Management**: Track multiple themes and conversation sessions
- **Persistent Storage**: All data saved locally in your browser

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- OpenRouter API key ([get one here](https://openrouter.ai/keys))

### Development

```bash
# Clone the repository
git clone https://github.com/loydmilligan/music-league-strategist.git
cd music-league-strategist

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

### Configuration

1. Click the **Settings** (gear icon) in the top-right corner
2. Enter your **OpenRouter API key**
3. (Optional) Configure Spotify and YouTube Music for playlist creation

Or create a `.env` file from the example:

```bash
cp .env.example .env
# Edit .env with your API keys
```

## Production Deployment

### Docker (Recommended)

```bash
# Build and run
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

The app will be available at http://localhost:3000

### Manual Build

```bash
npm run build
# Serve the dist/ directory with any static file server
```

## API Configuration

### OpenRouter (Required)

OpenRouter provides access to multiple AI models (Claude, GPT-4, Gemini, etc.).

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Create an API key at [openrouter.ai/keys](https://openrouter.ai/keys)
3. Add the key in Settings or as `VITE_OPENROUTER_API_KEY` in `.env`

### Spotify (Optional)

For creating and syncing Spotify playlists:

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Note your Client ID and Client Secret
3. Complete the OAuth flow to get a refresh token
4. Add credentials in Settings or as `VITE_SPOTIFY_*` in `.env`

### YouTube Music (Optional)

For creating YouTube Music playlists:

1. Create credentials at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials)
2. Enable the YouTube Data API v3
3. Complete the OAuth flow to get a refresh token
4. Add credentials in Settings or as `VITE_YOUTUBE_*` in `.env`

## Self-Hosted Runner Setup (Raspberry Pi)

For automated deployments using GitHub Actions:

```bash
# On the Pi
mkdir -p ~/actions-runner && cd ~/actions-runner

# Download runner (ARM64)
curl -o actions-runner-linux-arm64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-arm64-2.311.0.tar.gz
tar xzf actions-runner-linux-arm64-2.311.0.tar.gz

# Configure (get token from GitHub repo Settings → Actions → Runners)
./config.sh --url https://github.com/loydmilligan/music-league-strategist --token YOUR_TOKEN

# Install as service
sudo ./svc.sh install
sudo ./svc.sh start

# Create deployment directory
mkdir -p ~/music-league-strategist
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui (Radix primitives)
- **State**: Zustand with localStorage persistence
- **AI**: OpenRouter API
- **Music APIs**: Spotify, YouTube Data API, Songlink/Odesli

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/              # shadcn/ui primitives
│   └── *.tsx            # Feature components
├── stores/              # Zustand state management
├── services/            # External API clients
├── types/               # TypeScript definitions
└── lib/                 # Utilities
```

## License

MIT
