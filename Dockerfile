### Dockerfile for Node.js backend (adjust `CMD` to your start script if needed)
FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies first (leverage cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Use your package.json `start` script. For development override with docker-compose.
CMD ["npm", "start"]
