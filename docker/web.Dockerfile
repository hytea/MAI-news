FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/web ./packages/web
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build shared
WORKDIR /app/packages/shared
RUN npm run build

# Back to root
WORKDIR /app

# Expose port
EXPOSE 3000

# Start in development mode
CMD ["npm", "run", "dev", "--workspace=@news-curator/web"]
