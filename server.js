
import express from "express";
import cors from "cors";
import 'dotenv/config';
import { MongoClient, ObjectId } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { toNodeHandler } from "better-auth/node";
import { jwt } from "better-auth/plugins";
import { jwtVerify, createRemoteJWKSet } from "jose";

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

// Prevent duplicate event joins
await eventJoinsCollection.createIndex(
  { eventId: 1, userEmail: 1 },
  { unique: true }
);

console.log("Event join unique index created!");

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
  plugins: [jwt()],
});

const JWKS = createRemoteJWKSet(
  new URL("http://localhost:5000/api/auth/jwks")
);

const verifyJWT = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).send({
        message: "Unauthorized access",
      });
    }

    const token = authorization.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "http://localhost:5000",
      audience: "http://localhost:5000",
    });

    req.user = payload;

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).send({
      message: "Invalid or expired token",
    });
  }
};

// Better Auth route (must be before express.json)
app.all("/api/auth/*splat", toNodeHandler(auth));

// JSON middleware for other Express routes
app.use(express.json());



//GET api/events
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

//POST /api/events 
app.post("/api/events", verifyJWT, async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      thumbnail,
      location,
      date,
    } = req.body;

    // Check required fields
    if (
      !title ||
      !description ||
      !type ||
      !thumbnail ||
      !location ||
      !date
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
      creatorEmail: req.user.email,
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

//PATCH /api/events/:id 
app.patch("/api/events/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { ...updateData } = req.body;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
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
        creatorEmail: req.user.email,
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

//DELETE /api/events/:id 
app.delete("/api/events/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    // Delete only the event belonging to this creator
    const result = await eventsCollection.deleteOne({
      _id: new ObjectId(id),
      creatorEmail: req.user.email,
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

//GET /api/events/:id 
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


//POST /api/events/:id/join
app.post("/api/events/:id/join", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
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
    if (event.creatorEmail === req.user.email) {
      return res.status(400).send({
        message: "You cannot join your own event",
      });
    }

    // Check duplicate join
    const existingJoin = await eventJoinsCollection.findOne({
      eventId: new ObjectId(id),
      userEmail: req.user.email,
    });

    if (existingJoin) {
      return res.status(409).send({
        message: "You have already joined this event",
      });
    }

    // Save join information
    const joinData = {
      eventId: new ObjectId(id),
      userEmail: req.user.email,
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


// GET /api/joined-events
app.get("/api/joined-events", verifyJWT, async (req, res) => {
  try {
    const userEmail = req.user.email;
    // Check user email
    if (!userEmail) {
      return res.status(400).send({
        message: "User email is required",
      });
    }

    // Find all events joined by this user
    const joinedEvents = await eventJoinsCollection
      .find({ userEmail })
      .toArray();

    // Get event IDs
    const eventIds = joinedEvents.map((join) => join.eventId);
    // Return empty array if user has not joined any event
    if (eventIds.length === 0) {
      return res.status(200).send([]);
    }


    // Find corresponding event details
    const events = await eventsCollection
      .find({
        _id: { $in: eventIds },
      })
      .toArray();



    // Attach joinedAt information
    const result = events.map((event) => {
      const joinInfo = joinedEvents.find(
        (join) => join.eventId.toString() === event._id.toString()
      );

      return {
        ...event,
        joinedAt: joinInfo.joinedAt,
      };
    });

    // Sort by event date
    result.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).send(result);
  } catch (error) {
    console.error("Failed to fetch joined events:", error);

    res.status(500).send({
      message: "Failed to fetch joined events",
    });
  }
});

//DELETE /api/events/:id/leave
app.delete("/api/events/:id/leave", async (req, res) => {
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

    // Remove user's event registration
    const result = await eventJoinsCollection.deleteOne({
      eventId: new ObjectId(id),
      userEmail,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "You have not joined this event",
      });
    }

    res.status(200).send({
      message: "You have left the event successfully",
    });
  } catch (error) {
    console.error("Failed to leave event:", error);

    res.status(500).send({
      message: "Failed to leave event",
    });
  }
});


//GET /api/my-events
app.get("/api/my-events", async (req, res) => {
  try {
    const { email } = req.query;

    // Check creator email
    if (!email) {
      return res.status(400).send({
        message: "Creator email is required",
      });
    }

    // Find events created by this user
    const myEvents = await eventsCollection
      .find({ creatorEmail: email })
      .sort({ date: 1 })
      .toArray();

    res.status(200).send(myEvents);
  } catch (error) {
    console.error("Failed to fetch your events:", error);

    res.status(500).send({
      message: "Failed to fetch your events",
    });
  }
});


//GET /api/protected-test 

app.get("/api/protected-test", verifyJWT, (req, res) => {
  res.status(200).send({
    message: "JWT verification successful!",
    user: req.user,
  });
});



// Test route
app.get("/", (req, res) => {
  res.send("Kindora API is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Kindora server running on port ${PORT}`);
});
