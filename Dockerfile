# Base image with Node.js and FFmpeg
FROM node:20-slim

# Install FFmpeg and yt-dlp dependencies for server-side video rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Expose port (Cloud Run sets PORT automatically)
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
