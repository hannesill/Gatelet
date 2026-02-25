FROM node:22-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY dist/ ./dist/

ENV GATELET_DATA_DIR=/data
EXPOSE 4000 4001

CMD ["node", "dist/index.js"]
