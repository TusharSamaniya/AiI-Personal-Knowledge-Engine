FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies FIRST
# (before copying source so layer is cached)
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
