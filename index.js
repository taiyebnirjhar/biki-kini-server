const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middle_wares

app.use(cors());
app.use(express.json());

// db connection

const uri = process.env.URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJwtToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

/********/
async function run() {
  try {
    /********/

    const usersCollection = client.db("biki-kini").collection("users");
    const allProductsCollection = client
      .db("biki-kini")
      .collection("allProducts");
    const sellingProduct = client.db("biki-kini").collection("sellingProduct");
    const reportProduct = client.db("biki-kini").collection("reportProduct");
    const advertisedProduct = client.db("biki-kini").collection("adsProduct");
    /********/

    // {put email in db && generate jwt}

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = {
        email: email,
      };
      const option = { upsert: true };

      const updatedDoc = {
        $set: user,
      };

      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      const token = jwt.sign(user, process.env.SECRET, {
        expiresIn: "7d",
      });

      res.send({ result, token });
    });

    // {get all users}
    app.get("/user/:role", async (req, res) => {
      const userRole = req.params.role;

      if (userRole === "all") {
        const all = await usersCollection.find({}).toArray();
        res.send(all);
      } else {
        const result = await usersCollection
          .find({ role: `${userRole}` })
          .toArray();
        res.send(result);
      }
    });

    // {find user role}
    app.get("/role", async (req, res) => {
      const userUID = req.query.UID;

      const result = await usersCollection
        .find({ userId: `${userUID}` })
        .toArray();

      res.send(result);
    });

    // {get check admin}

    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    //check seller
    app.get("/user/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role === "seller" });
    });
    //check buyer

    app.get("/user/buyer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isBuyer: user?.role === "user" });
    });

    // {get products}
    app.get("/products/:id", async (req, res) => {
      const category = req.params.id;

      if (category === "all") {
        const all = await allProductsCollection.find({}).toArray();
        res.send(all);
      } else {
        const result = await allProductsCollection
          .find({ category: `${category}` })
          .toArray();
        res.send(result);
      }
    });
    app.get("/product/advertise", async (req, res) => {
      const result = await advertisedProduct.find({}).toArray();
      res.send(result);
    });
    // {update products for advertise}
    app.post("/product/advertise", async (req, res) => {
      const adsProd = req.body;
      const result = await advertisedProduct.insertOne(adsProd);
      res.send(result);
    });

    // get my prod
    app.get("/products/myproducts/:id", async (req, res) => {
      const sellerID = req.params.id;
      const query = {
        "seller.uid": `${sellerID}`,
      };
      const result = await allProductsCollection.find(query).toArray();
      // console.log(sellerID, result);

      res.send(result);
    });
    // delete user
    app.delete("/user/delete/:id", verifyJwtToken, async (req, res) => {
      const id = req.params.id;
      const filter = { userId: `${id}` };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    // delete prod
    app.delete("/products/myproducts/:id", verifyJwtToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await allProductsCollection.deleteOne(filter);
      res.send(result);
    });

    // admin delete prod from buyer collection
    app.delete("/admin/delete/myproducts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {
        productId: `${id}`,
      };
      const result = await sellingProduct.deleteOne(filter);
      res.send(result);
    });

    app.post("/seller/add-product", verifyJwtToken, async (req, res) => {
      const newProd = req.body;
      const result = await allProductsCollection.insertOne(newProd);
      res.send(result);
    });

    // {get booked products}

    app.get("/selling", verifyJwtToken, async (req, res) => {
      const userUID = req.query.UID;
      const decodedUID = req.decoded.userId;

      if (userUID !== decodedUID) {
        return res.status(403).send({ message: "forbidden access" });
      } else {
        const query = { buyeruid: userUID };
        const result = await sellingProduct.find(query).toArray();
        res.send(result);
      }
    });

    // {get reported product}

    app.get("/report", async (req, res) => {
      const result = await reportProduct.find({}).toArray();
      res.send(result);
    });
    // delete report

    app.delete("/report/:id", async (req, res) => {
      const id = req.params.id;

      const filter = {
        productId: `${id}`,
      };
      const result = await reportProduct.deleteOne(filter);
      res.send(result);
    });

    // {post products for booking}
    app.post("/selling", async (req, res) => {
      const sellingData = req.body;
      const query = {
        productId: sellingData.productId,
        buyeruid: sellingData.buyeruid,
      };
      const alreadyBooked = await sellingProduct.find(query).toArray();

      if (alreadyBooked && alreadyBooked.length) {
        const message = `You are already booked to buy this product `;
        return res.send({ acknowledged: false, message });
      } else {
        const result = await sellingProduct.insertOne(sellingData);

        res.send(result);
      }
    });
    // {post report for products}
    app.post("/report", async (req, res) => {
      const reportData = req.body;
      const query = {
        productId: reportData.productId,
        buyeruid: reportData.buyeruid,
      };
      const alreadyReported = await reportProduct.find(query).toArray();

      if (alreadyReported && alreadyReported.length) {
        const message = `You have already reported this product `;
        return res.send({ acknowledged: false, message });
      } else {
        const result = await reportProduct.insertOne(reportData);

        res.send(result);
      }
    });
  } finally {
  }
}
run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
