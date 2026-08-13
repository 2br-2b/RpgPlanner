FROM node:26.7.0-alpine

WORKDIR /app
ENV DATA_DIR=/data
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js tsconfig.server.json ./
COPY public/ public/
COPY src/ src/
COPY server/ server/
COPY scripts/ scripts/
RUN npm run build
RUN npm prune --omit=dev

USER node
EXPOSE 8000
CMD ["node", "build/server/index.js"]
