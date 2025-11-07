# Pick a node version, 
FROM node:lts

# Set the working directory inside the container. Think of this as a virtual enviornment.
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm i

# Copy the rest of the application code
COPY . .

# Create a non-root user for security
# groupadd creates a new group called 'nodejs' with group ID 1001
# -g 1001: sets the group ID to 1001
# useradd creates a new user called 'nodejs' with user ID 1001
# -u 1001: sets the user ID to 1001
# -g nodejs: assigns the user to the nodejs group
# -s /bin/bash: sets the shell to bash
# -m: creates a home directory for the user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nodejs

# Change ownership of the app directory to the nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose the port the app runs on
EXPOSE 25565

# Define the command to run the application
CMD ["npm", "start"]
