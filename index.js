const express = require('express');
const cors = require('cors');
require('dotenv').config()
const app = express();
// const router = express.Router();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o5v4c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const carCollection = client.db('carsDB').collection('cars')
    const carBookingCollection = client.db("carsDB").collection("carbooking");

    // Save all car data in db
    app.post('/add-cars', async (req, res) => {
      const carData = req.body
      const result = await carCollection.insertOne(carData)
      res.send(result)
    })

    // get all car data from db
    app.get('/cars', async (req, res) => {
      const result = await carCollection.find().toArray()
      res.send(result)
    })

    app.get('/cars/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await carCollection.findOne(query)
      res.send(result)
    })

    app.get('/my-cars/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const query = { userEmail: email };
        const result = await carCollection.find(query).toArray();
        res.status(200).send(result);
      } catch (error) {
        res.status(400).send('fetch failed my car');
      }
    });

    // My Car Update
    app.put('/cars/:id', async (req, res) => {
      const updatedCar = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const car = {
        $set: {
          carModel: updatedCar.carModel,
          dailyRentalPrice: updatedCar.dailyRentalPrice,
          availability: updatedCar.availability,
          vehicleRegistrationNumber: updatedCar.vehicleRegistrationNumber,
          features: updatedCar.features,
          description: updatedCar.description,
          bookingCount: updatedCar.bookingCount,
          carImage: updatedCar.carImage,
          location: updatedCar.location,
          bookingStatus: updatedCar.bookingStatus,
        },
      };
      try {
        const result = await carCollection.updateOne(filter, car);
        if (result.matchedCount === 0) {
          return res.status(404).send('Car not found');
        }
        res.status(200).send(result);
      } catch (error) {
        res.status(400).send('Failed to update car');
      }
    });


    // Car Booking Created
    app.post("/carBooking", async (req, res) => {
      const newCarBooking = req.body;
      const result = await carBookingCollection.insertOne(newCarBooking);      
      res.send(result);
    });

 


    // Delete route created
    app.delete('/cars/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await carCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send('Car not found');
        }

        res.status(200).send(result);
      } catch (error) {
        res.status(400).send('Failed to delete car');
      }
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('CarLink Server')
})

app.listen(port, () => {
  console.log(`running on port ${port}`);

})