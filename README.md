# MERN Chat App

A full-featured real-time chat application built with MongoDB, Express, React, and Node.js.

## Features

- **Real-time messaging** via Socket.io
- **JWT authentication** (register, login, persistent sessions)
- **Group chat rooms** (create, join, public/private)
- **Direct messages** (1-on-1 conversations)
- **Typing indicators** with debouncing
- **Online/offline status** tracking
- **Read receipts**
- **Message edit & delete**
- **Paginated message history**

## Project Structure

```
mern-chat/
├── server/               # Express + Socket.io backend
│   ├── models/           # Mongoose schemas (User, Room, Message)
│   ├── routes/           # REST API routes
│   ├── middleware/        # JWT auth middleware
│   ├── socket/           # Socket.io event handlers
│   └── index.js          # Server entry point
└── client/               # React frontend
    └── src/
        ├── context/       # React context (Auth, Socket, Chat)
        └── components/    # UI components (Auth, Chat)
```

## Setup

### Prerequisites
- Node.js 16+
- MongoDB (local or Atlas)

### 1. Server setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

### 2. Client setup

```bash
cd client
npm install
npm start
```

Open http://localhost:3000

## Environment Variables (server/.env)

| Variable    | Description                     | Default                              |
|-------------|---------------------------------|--------------------------------------|
| PORT        | Server port                     | 5000                                 |
| MONGO_URI   | MongoDB connection string        | mongodb://localhost:27017/mern-chat  |
| JWT_SECRET  | Secret for signing JWTs         | (required)                           |
| CLIENT_URL  | React app URL for CORS          | http://localhost:3000                |

## API Endpoints

| Method | Path                        | Description              | Auth |
|--------|-----------------------------|--------------------------|------|
| POST   | /api/auth/register          | Register new user        | No   |
| POST   | /api/auth/login             | Login                    | No   |
| GET    | /api/auth/me                | Get current user         | Yes  |
| GET    | /api/rooms                  | Get user's rooms         | Yes  |
| GET    | /api/rooms/public           | Get public rooms         | Yes  |
| POST   | /api/rooms                  | Create a room            | Yes  |
| POST   | /api/rooms/:id/join         | Join a room              | Yes  |
| POST   | /api/rooms/:id/leave        | Leave a room             | Yes  |
| GET    | /api/rooms/direct/:userId   | Get/create DM room       | Yes  |
| GET    | /api/messages/:roomId       | Get room messages        | Yes  |
| GET    | /api/users/search?q=        | Search users             | Yes  |

## Socket Events

### Client → Server
| Event          | Payload                      | Description          |
|----------------|------------------------------|----------------------|
| message:send   | { roomId, content, type }    | Send a message       |
| message:edit   | { messageId, content }       | Edit a message       |
| message:delete | { messageId }                | Delete a message     |
| typing:start   | { roomId }                   | Start typing         |
| typing:stop    | { roomId }                   | Stop typing          |
| room:join      | { roomId }                   | Join a socket room   |
| message:read   | { roomId }                   | Mark messages read   |

### Server → Client
| Event            | Payload                       | Description          |
|------------------|-------------------------------|----------------------|
| message:new      | Message object                | New message arrived  |
| message:updated  | Message object                | Message was edited   |
| message:deleted  | { messageId, roomId }         | Message was deleted  |
| typing:update    | { userId, username, roomId, isTyping } | User typing status |
| user:status      | { userId, status }            | User online/offline  |
| rooms:joined     | string[]                      | Initial room list    |

## Tech Stack

- **Backend**: Node.js, Express, Socket.io, Mongoose
- **Database**: MongoDB
- **Frontend**: React 18, React Router v6, Axios, date-fns
- **Auth**: JWT + bcryptjs
- **Real-time**: Socket.io (WebSockets)
