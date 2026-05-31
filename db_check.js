const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@phero-11-cluster.fugo1bp.mongodb.net/?retryWrites=true&w=majority&appName=pHero-11-Cluster`;
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const database = client.db("bloodDonationDb");
    const userCollection = database.collection("users");

    console.log("Connected to MongoDB database.");
    const users = await userCollection.find({}).toArray();
    
    if (users.length === 0) {
      console.log("No users found in the database. Please register a user first through the web app UI.");
    } else {
      console.log("Current Users in DB:");
      users.forEach(u => {
        console.log(`- Email: ${u.email}, Role: ${u.role}, Status: ${u.status}, Name: ${u.name}`);
      });

      // We will make the first user or a user with a specific email an admin.
      // Let's seed the first user as admin if they are not already.
      const firstUser = users[0];
      if (firstUser.role !== 'admin') {
        const result = await userCollection.updateOne(
          { _id: firstUser._id },
          { $set: { role: 'admin' } }
        );
        console.log(`\nUpdated user ${firstUser.email} to 'admin'. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
      } else {
        console.log(`\nUser ${firstUser.email} is already an 'admin'.`);
      }
    }
  } catch (err) {
    console.error("Error running script:", err);
  } finally {
    await client.close();
  }
}

run();
