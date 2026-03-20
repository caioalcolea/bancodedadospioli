FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies
COPY package.json ./
RUN npm install --production=false

# Install client dependencies and build
COPY client/package.json client/
RUN cd client && npm install

COPY client/ client/
RUN cd client && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server/ server/
COPY data/ data/
COPY --from=builder /app/client/dist client/dist

ENV NODE_ENV=production
ENV PORT=3456

EXPOSE 3456

CMD ["node", "server/index.js"]
