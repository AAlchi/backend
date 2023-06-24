const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const multer = require("multer");
const User = require("./models/userModel");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();
const secretKey = process.env.JWT_SECRET;

//mongodb

mongoose
  .connect(process.env.MONGODB_LINK, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((error) => {
    console.log(error);
  });

let fileName;

const storage = multer.diskStorage({
  destination: "./images",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = file.originalname.split(".").pop();
    fileName = uniqueSuffix + "." + fileExtension;
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage });

app.post("/signup", upload.single("image"), async (req, res) => {
  const fullName = req.body.fullName;
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const image = req.file;

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });

  if (existingUser) {
    return res.send("Username or email already taken");
  } else {
    const info = new User({
      fullName: fullName,
      username: username,
      email: email,
      password: bcrypt.hashSync(password),
      image: fileName,
    });

    info.save();
    res.send("All Signed Up");
  }
});

app.post("/signin", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const user = await User.findOne({ username: username });

  if (user) {
    //   const passwordMatch = await bcrypt.compare(password, user.password);
    //   if (passwordMatch) {
    //     // const payload = {
    //     //   username: username,
    //     // };
    //     // const token = jwt.sign(payload, secretKey);
    //     // res.cookie("jwtToken", token, {
    //     //   expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    //     //   httpOnly: true,
    //     // });
    //     res.json("hi");
    //   } else {
    //     res.json("Wrong Username or Password");
    //   }
    res.json("hi");
  } else {
    res.json("Wrong Username or Password");
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Running On Port {Not Shown}");
});
