FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies heavily using standard npm install
RUN npm install

# Copy project files
COPY . .

# Build the React app
ARG REACT_APP_API_BASE
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE
RUN CI=false npm run build

# Start the server
CMD ["npm", "start"]
