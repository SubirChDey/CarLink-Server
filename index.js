const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();
// const router = express.Router();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');


const corsOptions = {
  origin: ['http://localhost:5173', 'https://carlink-sbr.netlify.app'],
  credentials: true,
  optionalSuccessStatus: 200,
}
// middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o5v4c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// verify token
// const verifyToken = (req, res, next) => {
//   const token = req.cookies?.token
//   console.log(token);
//   if (!token) return res.status(401).send({ message: 'unauthorized access' })
//   jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
//     if (err) {
//       return res.status(401).send({ message: 'unauthorized access' })
//     }
//     else {
//       req.user = decoded
//     }
//   })
//   next()
// }

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: 'unauthorized access' });

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    req.user = decoded;
    next();
  });
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const carCollection = client.db('carsDB').collection('cars')
    const carBookingCollection = client.db("carsDB").collection("carbooking");

    // Generate JWT
    app.post('/jwt', async (req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.SECRET_KEY, { expiresIn: '24h', })
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true })
    })

    // logout, clear cookie from browser
    app.get('/logout', async (req, res) => {
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
        .send({ success: true })
    })

    // Save all car data in db
    app.post('/add-cars', async (req, res) => {
      const carData = req.body
      const result = await carCollection.insertOne(carData)
      res.send(result)
    })

    // get all car data from db
    // app.get('/cars', async (req, res) => {
    //   const query = req.query.availability
    //   console.log(query);
    //   let filter = {}
    //   if (query) {
    //     filter = { availability: "Available" }
    //   }
    //   const result = await carCollection.find(filter).toArray()
    //   res.send(result)
    // })

    app.get('/availableCars', async (req, res) => {
      const query = { availability: "Available"}
      const result = await carCollection.find(query).toArray()    
      res.send(result)
    })

    app.get('/recentListings', async (req, res) => {
      try {
        const result = await carCollection
          .find()
          .sort({ addedDate: -1 }).limit(6)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching recent listings:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get('/cars/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await carCollection.findOne(query)
      res.send(result)
    })

    app.get('/my-cars', verifyToken, async (req, res) => {
      try {
        const decodedEmail = req.user?.email
        const queryEmail = req.query.email;
        // const email = req.query.email;
        // console.log(queryEmail, decodedEmail);

        if (decodedEmail !== queryEmail) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        const query = { userEmail: queryEmail };
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

    // Assuming you’re using Express and MongoDB
    app.put("/carBooking/:id", async (req, res) => {
      const id = req.params.id;
      const { startDateTime, endDateTime } = req.body;

      try {
        const result = await carBookingCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              startDateTime: new Date(startDateTime),
              endDateTime: new Date(endDateTime),
            },
          }
        );
        res.send(result);
      } catch (err) {
        console.error("Failed to update booking", err);
        res.status(500).send({ error: "Internal server error" });
      }
    });



    // bookingCount updated
    app.post("/carBooking", async (req, res) => {
      const newCarBooking = req.body;
      // console.log("New Booking Received:", newCarBooking);

      try {
        const result = await carBookingCollection.insertOne(newCarBooking);
        const carId = newCarBooking.car_id;
        const filter = { _id: new ObjectId(carId) };
        const update = {
          $inc: { bookingCount: 1 },
        };

        const updateBookingCount = await carCollection.updateOne(filter, update);
        res.send({
          success: true,
          message: "Car booking successful",
          insertedId: result.insertedId,
        });

      } catch (error) {
        console.error("Error in carBooking route:", error);
        res.status(500).send({ error: "Something went wrong!" });
      }
    });

    // Get data from carBooking route
    app.get("/carBooking", verifyToken, async (req, res) => {
      const decodedEmail = req.user?.email;
      const email = req.query.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = { bookedBy: email };          
      const cursor = carBookingCollection.find(query);
      const result = await cursor.toArray();
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

    // my booking delete
    app.delete('/carBooking/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await carBookingCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).send('Car not found');
        }
        res.status(200).send(result);
      } catch (error) {
        res.status(400).send('Failed to delete car');
      }
    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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