FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai-providers/package.json ./packages/ai-providers/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY packages/ai-providers ./packages/ai-providers
COPY tsconfig.json ./

# Build shared and ai-providers
WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/packages/ai-providers
RUN npm run build

# Back to root
WORKDIR /app

# Expose port
EXPOSE 3001

# Start in development mode
CMD ["npm", "run", "dev", "--workspace=@news-curator/api"]
