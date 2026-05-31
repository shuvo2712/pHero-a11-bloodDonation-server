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

    // Get donation requests by user email (with optional status filtering and pagination)
    app.get('/donation-requests/user/:email', async (req, res) => {
      const email = req.params.email;
      const status = req.query.status;

      const query = { requesterEmail: email };
      if (status && status !== 'all') {
        query.donationStatus = status;
      }

      // Check if pagination parameters are provided
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      if (!isNaN(page) && !isNaN(limit)) {
        const skip = (page - 1) * limit;
        const total = await donationRequestCollection.countDocuments(query);
        const requests = await donationRequestCollection.find(query)
          .sort({ donationDate: -1, donationTime: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send({ total, requests });
      } else {
        // If not paginated, return all matched requests
        const requests = await donationRequestCollection.find(query)
          .sort({ donationDate: -1, donationTime: -1 })
          .toArray();
        res.send(requests);
      }
    });

    // Get all public pending donation requests
    app.get('/donation-requests/public', async (req, res) => {
      const query = { donationStatus: 'pending' };
      const requests = await donationRequestCollection.find(query)
        .sort({ donationDate: -1, donationTime: -1 })
        .toArray();
      res.send(requests);
    });

    // Get details of a single donation request
    app.get('/donation-requests/:id', async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid ID format' });
        }
        const query = { _id: new ObjectId(id) };
        const result = await donationRequestCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: 'Donation request not found' });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Internal server error', error: error.message });
      }
    });

    // Delete a specific donation request
    app.delete('/donation-requests/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationRequestCollection.deleteOne(query);
      res.send(result);
    });

    // Update details of a specific donation request
    app.patch('/donation-requests/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedData = req.body;
      const updateDoc = {
        $set: {
          recipientName: updatedData.recipientName,
          recipientDistrict: updatedData.recipientDistrict,
          recipientUpazila: updatedData.recipientUpazila,
          hospitalName: updatedData.hospitalName,
          fullAddressLine: updatedData.fullAddressLine,
          bloodGroup: updatedData.bloodGroup,
          donationDate: updatedData.donationDate,
          donationTime: updatedData.donationTime,
          requestMessage: updatedData.requestMessage,
        }
      };
      const result = await donationRequestCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Update status of a specific donation request (Done, Canceled, or In Progress with donor info)
    app.patch('/donation-requests/status/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { status, donorName, donorEmail } = req.body;

      const updateDoc = {
        $set: {
          donationStatus: status
        }
      };

      if (donorName && donorEmail) {
        updateDoc.$set.donorName = donorName;
        updateDoc.$set.donorEmail = donorEmail;
      }

      const result = await donationRequestCollection.updateOne(filter, updateDoc);
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
