const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@phero-11-cluster.fugo1bp.mongodb.net/?retryWrites=true&w=majority&appName=pHero-11-Cluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const database = client.db("bloodDonationDb");
    const userCollection = database.collection("users");
    const donationRequestCollection = database.collection("donationRequests");

    // Save user data to MongoDB
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null });
      }

      // Default fields: role: "donor", status: "active"
      const result = await userCollection.insertOne({
        ...user,
        role: 'donor',
        status: 'active'
      });
      res.send(result);
    });

    // Get user profile and role by email
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Update user profile details
    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedUser = req.body;
      const updateDoc = {
        $set: {
          name: updatedUser.name,
          photoURL: updatedUser.photoURL,
          bloodGroup: updatedUser.bloodGroup,
          district: updatedUser.district,
          upazila: updatedUser.upazila,
        }
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Create a new blood donation request
    app.post('/donation-requests', async (req, res) => {
      const requestData = req.body;

      // Security Constraint: Blocked users cannot create requests
      const userEmail = requestData.requesterEmail;
      const user = await userCollection.findOne({ email: userEmail });
      if (user && user.status === 'blocked') {
        return res.status(403).send({ message: 'Blocked users cannot create donation requests' });
      }

      // Default Status: pending
      const finalRequest = {
        ...requestData,
        donationStatus: 'pending'
      };

      const result = await donationRequestCollection.insertOne(finalRequest);
      res.send(result);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Routes
app.post('/jwt', (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
  res.send({ token });
});

app.get('/', (req, res) => {
    res.send('Blood donation server is running');
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
