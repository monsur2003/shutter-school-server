const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
   res.send("shutter school is runnig ");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.kjf5ogd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

const verifyJwt = (req, res, next) => {
   const authorization = req.headers.authorization;
   if (!authorization) {
      return res
         .status(401)
         .send({ error: true, message: "Unauthorized access" });
   }
   const token = authorization.split(" ")[1];
   jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
      if (err) {
         return res
            .status(401)
            .send({ error: true, message: "Unauthorized access" });
      }

      req.decoded = decoded;

      next();
   });
};

async function run() {
   try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();

      //   collection section
      const classCollection = client
         .db("shutterSchoolDb")
         .collection("classes");
      const selectedClassCollection = client
         .db("shutterSchoolDb")
         .collection("selectedClasses");
      const userCollection = client.db("shutterSchoolDb").collection("users");

      app.get("/classes", async (req, res) => {
         const result = await classCollection.find().toArray();
         res.send(result);
      });

      //   add class from instructor api
      app.post("/classes", async (req, res) => {
         const body = req.body;
         const result = await classCollection.insertOne(body);
         res.send(result);
      });

      //   update class

      app.put("/classes/:id", async (req, res) => {
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };

         const body = req.body;
         console.log(body);
         const updateClass = {
            $set: {
               name: body.name,
               price: body.price,
               seats: body.seats,
               image: body.image,
               status: "pending",
               feedback: "",
            },
         };
         const result = await classCollection.updateOne(filter, updateClass);
         res.send(result);
      });

      //   show class collection with specific email for instructor

      app.get("/myClasses", async (req, res) => {
         const email = req.query.email;
         const query = { instructor_email: email };
         const result = await classCollection.find(query).toArray();
         res.send(result);
      });

      //--------   approve class form admin
      app.patch("/classes/approve/:id", async (req, res) => {
         const id = req.params.id;

         const filter = { _id: new ObjectId(id) };
         const updateDoc = {
            $set: {
               status: "approved",
            },
         };
         const result = await classCollection.updateOne(filter, updateDoc);
         console.log("update success");
         res.send(result);
      });
      //   denied class from admin
      app.patch("/classes/deny/:id", async (req, res) => {
         const id = req.params.id;
         console.log("deny from admin", id);
         const filter = { _id: new ObjectId(id) };
         const updateDoc = {
            $set: {
               status: "denied",
            },
         };
         const result = await classCollection.updateOne(filter, updateDoc);
         res.send(result);
      });

      //   feedback from admin on class api

      app.patch("/classes/feedback/:id", async (req, res) => {
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };
         const body = req.body;

         console.log(body);
         const updateDoc = {
            $set: {
               feedback: body.feedback,
            },
         };
         const result = await classCollection.updateOne(filter, updateDoc);
         res.send(result);
      });

      //    login user  api
      app.post("/users", async (req, res) => {
         const user = req.body;
         const query = { email: user.email };
         const existingUser = await userCollection.findOne(query);
         if (existingUser) {
            return res.send({ error: "account already exists" });
         }

         const result = await userCollection.insertOne(user);
         res.send(result);
      });

      // make jwt api
      app.post("/jwt", async (req, res) => {
         const user = req.body;
         console.log(user);

         const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
            expiresIn: "1h",
         });
         res.send({ token });
      });

      // find user collection
      app.get("/users", async (req, res) => {
         const result = await userCollection.find().toArray();
         res.send(result);
      });

      //   make admin account
      app.patch("/users/admin/:id", async (req, res) => {
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };
         const updateDoc = {
            $set: {
               role: "admin",
            },
         };

         const result = await userCollection.updateOne(filter, updateDoc);
         res.send(result);
      });

      //   make instructor account
      app.patch("/users/instructor/:id", async (req, res) => {
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };
         const updateDoc = {
            $set: {
               role: "instructor",
            },
         };

         const result = await userCollection.updateOne(filter, updateDoc);
         res.send(result);
      });

      // find admin by email/ role

      app.get("/users/admin/:email", async (req, res) => {
         const email = req.params.email;

         const query = { email: email };
         const user = await userCollection.findOne(query);
         const result = { admin: user.role === "admin" };
         res.send(result);
      });

      //   find instructors by email/role

      app.get("/users/instructor/:email", async (req, res) => {
         const email = req.params.email;
         const query = { email: email };
         const user = await userCollection.findOne(query);
         const result = { instructor: user.role === "instructor" };
         res.send(result);
      });

      //   selected items  set on db
      app.post("/selectedClasses", async (req, res) => {
         const selectClass = req.body;
         const result = await selectedClassCollection.insertOne(selectClass);
         res.send(result);
      });
      //   find selected class by email address

      app.get("/selectedClasses", verifyJwt, async (req, res) => {
         const email = req.query.email;
         console.log(email);

         const dMail = req.decoded.email;
         if (email !== dMail) {
            return res.status(403).send({
               error: true,
               message: "forbidden access",
            });
         } else if (!email) {
            return res.send([]);
         }
         const query = { email: email };
         const result = await selectedClassCollection.find(query).toArray();
         res.send(result);
      });

      //   delete selected class
      app.delete("/selectedClass/:id", async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await selectedClassCollection.deleteOne(query);
         res.send(result);
      });

      //
      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log(
         "Pinged your deployment. You successfully connected to MongoDB!"
      );
   } finally {
      // Ensures that the client will close when you finish/error
      //   await client.close();
   }
}
run().catch(console.dir);

app.listen(port, (req, res) => {
   console.log(`server listening on ${port}`);
});
