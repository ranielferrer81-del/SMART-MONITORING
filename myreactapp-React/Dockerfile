FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies heavily using standard npm install
RUN npm install

# Copy project files
COPY . .

# Build the React app
RUN CI=false npm run build

# Start the server
CMD ["npm", "start"]
