# Discord Admin Check-in Website

This project provides a simple web interface for Discord server administrators to record their check-in and check-out times before performing server management tasks.

## Features

- **Discord OAuth2 Login** using `passport-discord`.
- **Check-in/Check-out Buttons** once logged in.
- **Announcements Sidebar** with mobile-friendly toggle.
- **Responsive Design** prioritizing mobile devices.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Discord application and obtain `CLIENT_ID` and `CLIENT_SECRET`.
3. Set environment variables and run the server:
   ```bash
   DISCORD_CLIENT_ID=YOUR_CLIENT_ID \
   DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET \
   CALLBACK_URL=http://localhost:3000/callback \
   node server.js
   ```
4. Open `http://localhost:3000` in your browser.

Announcements can be edited directly in `views/index.ejs`.
