FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspaces
COPY pnpm-workspace.yaml .
COPY package.json .
COPY packages/frontend ./packages/frontend
COPY packages/shared ./packages/shared

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build frontend
RUN pnpm -F @kroptos/frontend build

EXPOSE 3000

CMD ["pnpm", "-F", "@kroptos/frontend", "start"]
