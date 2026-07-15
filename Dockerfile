FROM node:20-bullseye AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema
COPY prisma ./prisma

# Install dependencies
RUN npm install

# Copy full source
COPY . .

# Build TypeScript + Prisma
RUN npm run build


# -------- Runtime image --------
FROM node:20-bullseye

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 5016

CMD ["node", "dist/server.js"]
