FROM node:20-alpine

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci

# Copy prisma schema BEFORE generate
COPY prisma ./prisma

# Copy the rest of the app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# TODO: Change to start:prod when ready for production
# CMD ["npm", "run", "start:prod"]

CMD ["npm", "run", "start:dev"]