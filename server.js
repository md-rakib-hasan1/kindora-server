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

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);

await client.connect();

console.log("MongoDB connected successfully!");

const db = client.db(process.env.DB_NAME);

// Better Auth Configuration
const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),

  emailAndPassword: {
    enabled: true,
  },
});

// Better Auth Route (Express 5)
app.all("/api/auth/*splat", toNodeHandler(auth));

// Body parser
app.use(express.json());

// Test Route
app.get("/", (req, res) => {
  res.send("Kindora API is running!");
});

// Start Server
app.listen(PORT, () => {
  console.log(`Kindora server running on port ${PORT}`);
});