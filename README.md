# IB Deadline Manager

A personal deadline management system built specifically for IB Diploma students. Track your Internal Assessments (IAs) and Extended Essay with AI-powered milestone generation and Google Calendar integration.

## Features

- **Dashboard View**: See all 7 IAs at a glance with progress tracking, status indicators, and upcoming deadlines
- **AI Milestone Generation**: Generate personalized 5-step milestones for each IA using Claude AI, tailored to IB assessment criteria
- **Timeline View**: Gantt-style visualization of all milestones across a 12-month timeline with conflict detection
- **Smart Rescheduling**: Automatically adjusts downstream milestones when you complete tasks early or late
- **Google Calendar Sync**: Push all milestones to Google Calendar with color-coded events and reminders
- **Warning System**: Get alerts for overdue tasks, workload overloads, and deadline risks
- **Dark Mode**: Clean, minimal dark interface optimized for focus

## Your IB Subjects

This system is hardcoded for your specific IB workload:

| Subject | Type | Word Count |
|---------|------|------------|
| Math AA HL IA | Mathematical Exploration | 2,200 |
| Physics HL IA | Scientific Investigation | 2,200 |
| Economics Commentary 1 | Microeconomics | 800 |
| Economics Commentary 2 | Macroeconomics | 800 |
| Economics Commentary 3 | International Economics | 800 |
| English Lang & Lit SL IA | Literary Analysis | 1,500 |
| History SL IA | Historical Investigation | 2,200 |
| Extended Essay | TBD | 4,000 |

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **UI**: Custom shadcn/ui-inspired components with Tailwind CSS
- **State**: localStorage persistence (no backend required)
- **AI**: Anthropic Claude API for milestone generation
- **Calendar**: Google Calendar API v3
- **Animations**: Framer Motion
- **Date Handling**: date-fns

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd Sarvum
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 3. Get API Keys

#### Anthropic API Key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to API Keys and create a new key
4. Copy the key to your `.env` file

#### Google Cloud Setup (for Calendar integration)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API" and enable it
4. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - `https://your-domain.vercel.app` (for production)
   - Copy the Client ID to your `.env` file
5. Configure OAuth consent screen:
   - Go to "OAuth consent screen"
   - Fill in app name and user support email
   - Add your email as a test user (while in testing mode)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production

```bash
npm run build
```

### 6. Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Deploy
vercel --prod
```

Don't forget to add your environment variables in Vercel's project settings!

## Usage

### Generating Plans

1. Click "Generate Plan" on any IA card, or use "Generate All Plans" button in the header
2. AI will create 5 milestones with deadlines working backwards from your master deadline
3. Each milestone includes IB-specific guidance and realistic time estimates

### Tracking Progress

1. Click any IA card to open the detail modal
2. Check off milestones as you complete them (enjoy the confetti!)
3. The system will automatically reschedule remaining milestones

### Editing Deadlines

1. In the detail modal, click the date next to any milestone
2. Select a new date and save
3. All downstream milestones will be adjusted automatically

### Calendar Sync

1. Go to Settings tab
2. Click "Connect Google" and authorize access
3. Click "Sync to Calendar" to push all milestones
4. A new calendar "IB Deadlines - Kavin" will be created with all events

## Project Structure

```
src/
├── components/
│   ├── ui/              # Base UI components (Button, Card, etc.)
│   ├── dashboard/       # Dashboard-specific components
│   ├── timeline/        # Timeline view components
│   └── modals/          # Modal components
├── hooks/
│   └── useLocalStorage.ts   # State persistence hook
├── services/
│   ├── ai.ts            # Anthropic API integration
│   ├── calendar.ts      # Google Calendar integration
│   └── reschedule.ts    # Rescheduling logic
├── types/
│   └── index.ts         # TypeScript type definitions
├── lib/
│   └── utils.ts         # Utility functions
├── App.tsx              # Main application component
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## Configuration

### Master Deadline
Default: December 31, 2025. Change in Settings tab.

### Weekly Hours Budget
Default: 6 hours/week. The system will warn you if scheduled work exceeds this budget.

### Timezone
Events are created in Kerala IST (UTC+5:30).

## Notes

- All data is stored locally in your browser's localStorage
- No backend server required - runs entirely client-side
- API calls go directly to Anthropic and Google from your browser
- Works offline once milestones are generated (except for new AI generation and calendar sync)

## License

Personal use only. Built for Kavin's IB journey.
