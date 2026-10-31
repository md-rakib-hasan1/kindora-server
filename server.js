import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from 'mongodb';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());




const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error("MongoDB connection failed",err);
    throw err;
  }
}

const connectClient= await connectToMongoDB();


// Test route
app.get("/", (req, res) => {
  res.send("Kindora API is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Kindora server running on port ${PORT}`);
});