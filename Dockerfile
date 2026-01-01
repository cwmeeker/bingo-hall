# Use official Node image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

# Expose the port your server uses
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
