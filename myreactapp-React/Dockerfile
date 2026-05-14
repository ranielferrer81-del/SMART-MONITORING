FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies heavily using standard npm install
RUN npm install

# Copy project files
COPY . .

# Build the React app (ARG used when Railway passes build-args; runtime patch handles the rest)
ARG REACT_APP_API_BASE
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE
RUN CI=false npm run build

RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
