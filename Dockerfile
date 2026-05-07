FROM node:24-slim

WORKDIR /app
ENV DATA_DIR=/data
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js tsconfig.server.json ./
COPY src/ src/
COPY server/ server/
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 8000
CMD ["node", "build/server/index.js"]
