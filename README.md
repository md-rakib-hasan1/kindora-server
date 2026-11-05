# Kindora Server — Backend API

Kindora is a Social Development Events Platform that helps people create, discover, and participate in community service events.

This repository contains the backend API built with Express.js, MongoDB, and Better Auth.

## Live API

https://kindora-server-47it.onrender.com

## Features

- **Event Management:** Create, retrieve, update, and delete community events.
- **Upcoming Events:** Retrieve all upcoming events sorted by date.
- **Featured Events:** Retrieve up to six upcoming events for the homepage.
- **Event Details:** Get individual event information and participant counts.
- **Join Events:** Allow authenticated users to join upcoming events.
- **Joined Events:** Retrieve events joined by the logged-in user.
- **My Events:** Retrieve events created by the logged-in user.
- **Leave Events:** Allow users to leave events they previously joined.
- **JWT Authentication:** Protect private API endpoints using Better Auth JWT verification.
- **Ownership Protection:** Only event creators can update or delete their own events.

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Better Auth
- JSON Web Token (JWT)
- JavaScript
- CORS
- dotenv

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Check server status |
| GET | `/api/events` | Get all upcoming events |
| GET | `/api/events/featured` | Get up to six upcoming events |
| GET | `/api/events/:id` | Get event details |

### Authentication Endpoints

Better Auth handles authentication through:

`/api/auth/*`

### Protected Endpoints

These endpoints require a valid JWT Bearer token.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/events` | Create an event |
| PATCH | `/api/events/:id` | Update an event |
| DELETE | `/api/events/:id` | Delete an event |
| POST | `/api/events/:id/join` | Join an event |
| GET | `/api/events/:id/join-status` | Check joining status |
| GET | `/api/joined-events` | Get joined events |
| DELETE | `/api/events/:id/leave` | Leave an event |
| GET | `/api/my-events` | Get events created by the user |

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/md-rakib-hasan1/kindora-server.git
```

### 2. Navigate to the Project

```bash
cd kindora-server
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
DB_NAME=kindora

BETTER_AUTH_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Replace the placeholder values with your actual credentials.

### 5. Run the Development Server

```bash
npm run dev
```

The backend API will run at:

`http://localhost:5000`

## Database

- Database name: `kindora`
- Collections:
  - `events`
  - `eventJoins`

## Related Repository

**Frontend Repository:** https://github.com/md-rakib-hasan1/kindora-client

**Live Website:** https://kindora-client-seven.vercel.app/

---

© 2026 Kindora. Building stronger communities together.