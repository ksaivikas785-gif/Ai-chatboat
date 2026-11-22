# My AI Chatbot

A ChatGPT-style chatbot built from scratch. It runs on a free local AI model (Ollama), so no API key or payment is needed.

## Features

- Signup and login (passwords are hashed, sessions use JWT)
- Multiple chats in a sidebar
- Chat history saved in a database (SQLite)
- Dark and light mode
- Runs fully on your own computer

## Tech stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express
- Database: SQLite (better-sqlite3)
- AI model: Ollama with llama3.2

## Requirements

- Node.js 18 or newer
- Ollama (https://ollama.com)

## How to run

1. Install the AI model:

   ```
   ollama pull llama3.2
   ```

2. Clone this repo and install packages:

   ```
   git clone https://github.com/ksaivikas785-gif/Ai-chatboat.git
   cd Ai-chatboat
   npm install
   ```

3. Create a file named `.env` in the project folder with this content:

   ```
   PORT=3000
   JWT_SECRET=type-any-long-random-text-here
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```

4. Start the chatbot:

   ```
   npm start
   ```

5. Open http://localhost:3000, sign up, and start chatting.

## Project structure

```
server.js        Backend: accounts, chats, and the connection to Ollama
public/          Website files
  index.html     Page layout
  style.css      Styling and themes
  app.js         Chat and login logic
```

## Notes

- Replies can take up to a minute the first time, while the model loads.
- The `.env` file and the database are not uploaded to GitHub.
- To share it online for a demo, a free Cloudflare quick tunnel works while your computer is on.

## Author

Built by sai vikas.
