FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspaces
COPY pnpm-workspace.yaml .
COPY package.json .
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build backend
RUN pnpm -F @kroptos/backend build

EXPOSE 3001

CMD ["pnpm", "-F", "@kroptos/backend", "start"]
