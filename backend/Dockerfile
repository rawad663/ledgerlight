FROM node:20-alpine

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci

# Copy app
COPY . .

EXPOSE 8080

CMD ["npm", "run", "dev"]