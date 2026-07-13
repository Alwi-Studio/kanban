FROM node:20-alpine

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
