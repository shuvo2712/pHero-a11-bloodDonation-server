const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

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
