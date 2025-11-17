# NewsCurator AI

An AI-powered news curation platform that transforms the news consumption experience by personalizing, rewriting, and enriching news content in each user's preferred style while maintaining source transparency and journalistic integrity.

## Features

### Phase 1: MVP (Current)

- **User Authentication**: JWT-based authentication with email/password
- **News Aggregation**: RSS feed ingestion from major news outlets
- **AI Processing**: OpenRouter integration for article rewriting
- **Style Profiles**: Multiple writing styles (conversational, academic, bullet-point, etc.)
- **Source Citations**: Transparent source tracking and citation system
- **User Preferences**: Customizable topic and source preferences

## Tech Stack

### Backend
- **Framework**: Fastify
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **AI Provider**: OpenRouter (with support for multiple providers)
- **Authentication**: JWT tokens

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: Zustand + React Query
- **Styling**: Tailwind CSS

### Architecture
- **Monorepo**: Workspace-based monorepo with npm workspaces
- **Packages**:
  - `@news-curator/api` - Fastify API server
  - `@news-curator/web` - React frontend
  - `@news-curator/shared` - Shared types and utilities
  - `@news-curator/ai-providers` - AI provider implementations

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Docker and Docker Compose (recommended)
- PostgreSQL 14+ (if not using Docker)
- Redis 7+ (if not using Docker)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MAI-news
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example packages/api/.env
   ```

   Edit `packages/api/.env` and add your configuration:
   - Set `AI_API_KEY` to your OpenRouter API key
   - Update JWT secrets for production
   - Configure database credentials if not using Docker

4. **Start with Docker (Recommended)**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database on port 5432
   - Redis on port 6379
   - API server on port 3001
   - Web frontend on port 3000

5. **Or start manually**

   Start PostgreSQL and Redis, then:
   ```bash
   # Run database migrations
   npm run migrate:up --workspace=@news-curator/api

   # Start API server
   npm run dev --workspace=@news-curator/api

   # In another terminal, start web frontend
   npm run dev --workspace=@news-curator/web
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Project Structure

```
news-curator/
├── packages/
│   ├── api/                 # Fastify API server
│   │   ├── src/
│   │   │   ├── config/     # Configuration files
│   │   │   ├── middleware/ # Auth middleware
│   │   │   ├── routes/     # API routes
│   │   │   ├── services/   # Business logic
│   │   │   ├── app.ts      # Fastify app setup
│   │   │   └── index.ts    # Entry point
│   │   ├── migrations/     # Database migrations
│   │   └── tests/          # API tests
│   │
│   ├── web/                # React frontend
│   │   ├── src/
│   │   │   ├── components/ # React components
│   │   │   ├── pages/      # Page components
│   │   │   ├── hooks/      # Custom hooks
│   │   │   ├── services/   # API services
│   │   │   ├── store/      # State management
│   │   │   └── App.tsx     # Root component
│   │   └── tests/          # Frontend tests
│   │
│   ├── shared/             # Shared code
│   │   └── src/
│   │       ├── types/      # TypeScript types
│   │       └── utils/      # Utility functions
│   │
│   └── ai-providers/       # AI provider implementations
│       └── src/
│           ├── base/       # Base provider class
│           ├── providers/  # Provider implementations
│           └── factory.ts  # Provider factory
│
├── docker/                 # Docker configurations
│   ├── api.Dockerfile
│   └── web.Dockerfile
│
├── docs/                   # Documentation
├── scripts/                # Build/deploy scripts
└── docker-compose.yml      # Docker Compose config
```

## Database Schema

The database includes the following tables:

- **users**: User accounts and authentication
- **sources**: News sources and reliability scores
- **articles**: Original news articles
- **style_profiles**: User-defined writing styles
- **rewritten_articles**: AI-processed article versions
- **citations**: Source citations and references
- **user_preferences**: User preferences and settings
- **reading_history**: Article reading analytics
- **saved_articles**: User-saved articles

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Articles (Coming Soon)
- `GET /api/articles` - List articles
- `GET /api/articles/:id` - Get article details
- `POST /api/articles/:id/rewrite` - Rewrite article in user's style

### Style Profiles (Coming Soon)
- `GET /api/style-profiles` - List user's style profiles
- `POST /api/style-profiles` - Create style profile
- `PUT /api/style-profiles/:id` - Update style profile
- `DELETE /api/style-profiles/:id` - Delete style profile

### User Preferences (Coming Soon)
- `GET /api/user/preferences` - Get preferences
- `PUT /api/user/preferences` - Update preferences

## Development

### Running Tests
```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test --workspace=@news-curator/api
npm run test --workspace=@news-curator/web
```

### Building
```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@news-curator/api
```

### Database Migrations
```bash
# Create new migration
npm run migrate:create migration-name --workspace=@news-curator/api

# Run migrations
npm run migrate:up --workspace=@news-curator/api

# Rollback migrations
npm run migrate:down --workspace=@news-curator/api
```

### Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format
```

## AI Provider Configuration

The application uses a provider pattern for AI services. Currently supports:

- **OpenRouter**: Multi-model AI gateway (implemented)
- **OpenAI**: Direct OpenAI API (coming soon)
- **Anthropic**: Direct Anthropic API (coming soon)

To configure OpenRouter:

1. Get an API key from [OpenRouter](https://openrouter.ai/)
2. Set `AI_PROVIDER=openrouter` in your `.env`
3. Set `AI_API_KEY=your-key`
4. Choose a model (e.g., `anthropic/claude-3-haiku`)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

### Phase 1: MVP (Current)
- [x] Monorepo setup
- [x] Authentication system
- [x] Database schema
- [x] AI provider integration
- [ ] News ingestion engine
- [ ] Article rewriting system
- [ ] Basic frontend

### Phase 2: Engagement Features
- [ ] Advanced AI features (bias detection, context enrichment)
- [ ] Reading experience enhancements
- [ ] Social features
- [ ] Notification system

### Phase 3: Monetization & Scale
- [ ] Native advertising integration
- [ ] Premium subscription tier
- [ ] Analytics dashboard
- [ ] Mobile applications

## Support

For issues, questions, or contributions, please open an issue on GitHub.
