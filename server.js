
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
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
const eventsCollection = db.collection("events");
const eventJoinsCollection = db.collection("eventJoins");

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

//get api/events

app.get("/api/events", async (req, res) => {
  try {
    const events = await eventsCollection
      .find({
        date: { $gte: new Date() },
      })
      .sort({ date: 1 })
      .toArray();

    res.status(200).send(events);
  } catch (error) {
    console.error("Failed to fetch events:", error);

    res.status(500).send({
      message: "Failed to fetch events",
    });
  }
});

// get events details/id
app.get("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    // Find event by ID
    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    res.status(200).send(event);
  } catch (error) {
    console.error("Failed to fetch event details:", error);

    res.status(500).send({
      message: "Failed to fetch event details",
    });
  }
});

//post join events/id
app.post("/api/events/:id/join", async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    // Check user email
    if (!userEmail) {
      return res.status(400).send({
        message: "User email is required",
      });
    }

    // Check whether event exists
    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    // Prevent event creator from joining their own event
    if (event.creatorEmail === userEmail) {
      return res.status(400).send({
        message: "You cannot join your own event",
      });
    }

    // Check duplicate join
    const existingJoin = await eventJoinsCollection.findOne({
      eventId: new ObjectId(id),
      userEmail,
    });

    if (existingJoin) {
      return res.status(409).send({
        message: "You have already joined this event",
      });
    }

    // Save join information
    const joinData = {
      eventId: new ObjectId(id),
      userEmail,
      joinedAt: new Date(),
    };

    const result = await eventJoinsCollection.insertOne(joinData);

    res.status(201).send({
      message: "Event joined successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Failed to join event:", error);

    res.status(500).send({
      message: "Failed to join event",
    });
  }
});

//POST /api/events
app.post("/api/events", async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      thumbnail,
      location,
      date,
      creatorEmail,
    } = req.body;

    // Check required fields
    if (
      !title ||
      !description ||
      !type ||
      !thumbnail ||
      !location ||
      !date ||
      !creatorEmail
    ) {
      return res.status(400).send({
        message: "All fields are required",
      });
    }

    // Validate event date
    const eventDate = new Date(date);

    if (Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) {
      return res.status(400).send({
        message: "Event date must be in the future",
      });
    }

    const newEvent = {
      title,
      description,
      type,
      thumbnail,
      location,
      date: eventDate,
      creatorEmail,
      createdAt: new Date(),
    };

    const result = await eventsCollection.insertOne(newEvent);

    res.status(201).send({
      message: "Event created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Failed to create event:", error);

    res.status(500).send({
      message: "Failed to create event",
    });
  }
});

// upDate api/events/id 

app.patch("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { creatorEmail, ...updateData } = req.body;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    // Check required owner information
    if (!creatorEmail) {
      return res.status(400).send({
        message: "Creator email is required",
      });
    }

    // Only allow these fields to be updated
    const allowedFields = [
      "title",
      "description",
      "type",
      "thumbnail",
      "location",
      "date",
    ];

    const updatedFields = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updatedFields[field] = updateData[field];
      }
    });

    if (Object.keys(updatedFields).length === 0) {
      return res.status(400).send({
        message: "No valid fields provided for update",
      });
    }

    // Validate updated date
    if (updatedFields.date !== undefined) {
      const eventDate = new Date(updatedFields.date);

      if (
        Number.isNaN(eventDate.getTime()) ||
        eventDate <= new Date()
      ) {
        return res.status(400).send({
          message: "Event date must be in the future",
        });
      }

      updatedFields.date = eventDate;
    }

    // Update only the event belonging to this creator
    const result = await eventsCollection.updateOne(
      {
        _id: new ObjectId(id),
        creatorEmail,
      },
      {
        $set: updatedFields,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Event not found or you are not the owner",
      });
    }

    res.status(200).send({
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Failed to update event:", error);

    res.status(500).send({
      message: "Failed to update event",
    });
  }
});

//delete api/events/id

app.delete("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { creatorEmail } = req.body;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    if (!creatorEmail) {
      return res.status(400).send({
        message: "Creator email is required",
      });
    }

    // Delete only the event belonging to this creator
    const result = await eventsCollection.deleteOne({
      _id: new ObjectId(id),
      creatorEmail,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Event not found or you are not the owner",
      });
    }

    res.status(200).send({
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete event:", error);

    res.status(500).send({
      message: "Failed to delete event",
    });
  }
});


// Test route
app.get("/", (req, res) => {
  res.send("Kindora API is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Kindora server running on port ${PORT}`);
});
