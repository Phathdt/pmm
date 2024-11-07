FROM node:22-alpine as builder
WORKDIR /app
RUN apk update && apk add --no-cache gcc musl-dev git
COPY package.json .
COPY yarn.lock .
RUN yarn install
COPY . .
RUN yarn build

# Deployment environment
# ----------------------
FROM node:22-alpine
WORKDIR /app
RUN apk update && apk add --no-cache curl

COPY --from=builder ./app/dist/apps/api-server .
COPY --from=builder ./app/apps/api-server/run.sh .
RUN yarn add zod
RUN yarn install --production

ENTRYPOINT sh run.sh
