FROM node:20-bookworm-slim

RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
COPY backend/.npmrc ./

RUN npm install

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/. .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
