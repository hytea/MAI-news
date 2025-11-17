# NewsCurator AI - Web Frontend

React frontend for the NewsCurator AI platform.

## Features

- **Authentication**: Login and registration with JWT
- **News Feed**: Infinite scrolling news feed with category filters
- **Article Reader**: Read articles with AI style switching
- **User Preferences**: Customize reading style, topics, and notifications
- **Reading History**: Track and revisit previously read articles
- **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Axios
- Zustand (state management)
- React Query (data fetching)

## Getting Started

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at http://localhost:3000

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── ArticleCard.tsx
│   ├── CategoryFilter.tsx
│   ├── Layout.tsx
│   ├── Navbar.tsx
│   ├── ProtectedRoute.tsx
│   ├── SourcePanel.tsx
│   └── StyleSwitcher.tsx
├── contexts/          # React contexts
│   └── AuthContext.tsx
├── hooks/             # Custom React hooks
│   └── useInfiniteScroll.ts
├── pages/             # Page components
│   ├── ArticleReader.tsx
│   ├── Login.tsx
│   ├── NewsFeed.tsx
│   ├── ReadingHistory.tsx
│   ├── Register.tsx
│   └── Settings.tsx
├── services/          # API client and services
│   └── api.ts
├── types/             # TypeScript type definitions
│   └── index.ts
├── utils/             # Utility functions
│   └── formatting.ts
├── App.tsx            # Main app component with routing
├── main.tsx           # App entry point
└── index.css          # Global styles
```

## Available Routes

- `/login` - Login page
- `/register` - Registration page
- `/` - News feed (protected)
- `/article/:id` - Article reader (protected)
- `/settings` - User settings (protected)
- `/history` - Reading history (protected)

## API Integration

The frontend communicates with the Fastify API server running on port 3001. API calls are proxied through Vite's dev server configuration.

## Features Implementation

### Authentication
- JWT-based authentication with refresh tokens
- Protected routes redirect to login
- Auto-logout on 401 responses

### News Feed
- Infinite scroll implementation
- Category filtering
- Search functionality
- Responsive article cards

### Article Reader
- AI style switching (6 different styles)
- Source transparency with citations
- Reading progress tracking
- Share and save functionality

### User Settings
- Preferred reading style
- Topic preferences (follow/mute)
- Notification settings
- Reading time preferences

## Environment Variables

Create a `.env` file in the package root:

```
VITE_API_URL=http://localhost:3001
```

## License

MIT
