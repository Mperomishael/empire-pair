FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install only production deps
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

# Expose the port Back4App will route to
EXPOSE 3000

# Healthcheck so Back4App knows the container is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the portal
CMD ["node", "server.js"]
