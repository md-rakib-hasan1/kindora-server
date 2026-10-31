
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { toNodeHandler } from "better-auth/node";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

console.log("MongoDB connected successfully!");

const db = client.db(process.env.DB_NAME);

// Better Auth configuration
const auth = betterAuth({
  database: mongodbAdapter(db, { client }),

  baseURL: "http://localhost:5000",
   trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5000",
  ],


  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
});

// Better Auth route (must be before express.json)
app.all("/api/auth/*splat", toNodeHandler(auth));

// JSON middleware for other Express routes
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Kindora API is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Kindora server running on port ${PORT}`);
});
