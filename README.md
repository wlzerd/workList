# Discord Admin Check-in Website

This project provides a simple web interface for Discord server administrators to record their check-in and check-out times before performing server management tasks.

## Features

- **Discord OAuth2 Login** using `passport-discord`.
- **Check-in/Check-out Buttons** once logged in.
- **Sidebar Navigation** to Announcements, Check-in/out and Admin Status with mobile-friendly toggle.
- **Admin Status Page** shows currently checked-in administrators.
- **Discord Bot** stores guild role names and permission flags in SQLite and uses them to verify admin access.
- **Members with role ID `1015569732532961310` may log in even if the role lacks administrator permissions.**

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Discord application and bot. Obtain `CLIENT_ID`, `CLIENT_SECRET` and a bot token.
3. Set environment variables and run the server:
   ```bash
   DISCORD_CLIENT_ID=YOUR_CLIENT_ID \
   DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET \
   DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN \
   GUILD_ID=YOUR_GUILD_ID \
   ADMIN_ROLE_ID=ROLE_ID_WITH_ADMIN \ # optional
   CALLBACK_URL=http://localhost:3000/callback \
   node server.js
   ```
4. Open `http://localhost:3000` in your browser.

Announcements can be edited directly in `views/announcements.ejs`.

## Docker Compose

You can also run the project using Docker. Create a `.env` file with your Discord credentials and start the stack with Docker Compose 3.8:

```bash
DISCORD_CLIENT_ID=YOUR_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN
GUILD_ID=YOUR_GUILD_ID
ADMIN_ROLE_ID=ROLE_ID_WITH_ADMIN  # optional
CALLBACK_URL=http://localhost:3000/callback

docker compose up -d
```

The web interface will be available on `http://localhost:3000`.
