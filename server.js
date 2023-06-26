const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const multer = require("multer");
const User = require("./models/userModel");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceKeyForFirebase.json");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "mttchat-7b8a5.appspot.com",
  databaseURL: "https://mttchat-7b8a5-default-rtdb.firebaseio.com",
});

const bucket = admin.storage().bucket();

const uploadImageToFirebaseStorage = async (file) => {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const fileExtension = file.originalname.split(".").pop();
  const fileName = uniqueSuffix + "." + fileExtension;

  const fileUpload = bucket.file(fileName);

  const stream = fileUpload.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
    resumable: false,
  });

  return new Promise((resolve, reject) => {
    stream.on("error", (error) => {
      reject(error);
    });

    stream.on("finish", () => {
      resolve(fileName);
    });

    stream.end(file.buffer);
  });
};

const upload = multer();

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
    const fileName = await uploadImageToFirebaseStorage(image);
    const info = new User({
      fullName: fullName,
      username: username,
      email: email,
      password: bcrypt.hashSync(password),
      image: fileName,
      friends: [""],
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
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      const payload = {
        username: username,
        profilePic: user.image,
        id: user._id,
      };
      const token = jwt.sign(payload, secretKey);
      res.cookie("token", token, {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
        httpOnly: false,
      });
      res.json("Signed In");
    } else {
      res.json("Wrong Username or Password");
    }
  } else {
    res.json("Wrong Username or Password");
  }
});

app.post("/checkToken", (req, res) => {
  const jwtToken = req.cookies.token;

  if (jwtToken) {
    try {
      const decoded = jwt.verify(jwtToken, secretKey);

      const usernameDecoded = decoded.username;
      const profilePic = decoded.profilePic;
      const id = decoded.id;
      res.json({ username: usernameDecoded, profilePic: profilePic, id: id });
    } catch (error) {
      res.json("wrong");
    }
  } else {
    res.json("wrong");
  }
});

const db = admin.database();

app.post("/sendMessage", upload.single("image"), async (req, res) => {
  const image = req.file;
  const message = req.body.message;
  const username = req.body.username;
  const profilePic = req.body.profilePic;
  const id = req.body.id;
  const idTwo = req.body.idTwo;
  const to = req.body.to;

  if (!image) {
    try {
      const chat = db.ref("chats");
      const newChat = {
        message: message,
        imageName: "none",
        username: username,
        profilePic: profilePic,
        id: id,
        idTwo: idTwo,
        to: to,
      };
      const chatSnapshot = await chat.push(newChat);

      res.json({ message: "Message Sent", chatId: chatSnapshot.key });
    } catch (error) {
      res.json({ error: "Error sending message" });
    }
  } else {
    try {
      const fileName = await uploadImageToFirebaseStorage(image);

      const chat = db.ref("chats");
      const newChat = {
        message: message,
        imageName: fileName,
        username: username,
        profilePic: profilePic,
        id: id,
        idTwo: idTwo,
        to: to,
      };
      const chatSnapshot = await chat.push(newChat);

      res.json({ message: "Message Sent", chatId: chatSnapshot.key });
    } catch (error) {
      res.json({ error: "Error sending message" });
    }
  }
});

app.post("/getPeople", async (req, res) => {
  const people = await User.find().exec();

  if (people) {
    res.json(people);
  } else {
    res.json("No One Signed Up Yet.");
  }
});

app.post("/logout", (req, res) => {
  const cookies = Object.keys(req.cookies);

  cookies.forEach((cookieName) => {
    res.clearCookie(cookieName);
  });

  res.send("All cookies cleared");
});

app.post("/getMessages", async (req, res) => {
  const id = req.body.id;
  const idTwo = req.body.idTwo;

  try {
    const chat = db.ref("chats");
    const snapshot = await chat.once("value");
    const messages = [];

    snapshot.forEach((childSnapshot) => {
      const chatId = childSnapshot.key;
      const chatData = childSnapshot.val();
      const { message, imageName, username, profilePic, to } = chatData;
      let imageURL = "";
      let profilePicture = "";

      profilePicture = `https://firebasestorage.googleapis.com/v0/b/mttchat-7b8a5.appspot.com/o/${profilePic}?alt=media&`;

      if (imageName !== "none") {
        imageURL = `https://firebasestorage.googleapis.com/v0/b/mttchat-7b8a5.appspot.com/o/${imageName}?alt=media&`;
      }

      messages.push({
        chatId,
        message,
        imageName,
        username,
        imageURL,
        profilePicture,
        to,
      });
    });

    res.json(messages);
  } catch (error) {
    res.json("Error retrieving messages");
  }
});

app.post("/getFriends", async (req, res) => {
  const username = req.body.username;

  const user = await User.findOne({ username: username });

  if (user) {
    if (user.friends.length == 0) {
      res.send("You don't have any friends");
    } else {
      const friendProfiles = await Promise.all(
        user.friends.map(async (friendUsername) => {
          const friend = await User.findOne({ username: friendUsername });
          if (friend) {
            return {
              username: friend.username,
              image: friend.image,
              id: friend._id,
            };
          }
        })
      );

      res.json(friendProfiles);
    }
  } else {
    res.send("User not found");
  }
});

app.post("/checkTalkingTo", async (req, res) => {
  const id = req.body.id;

  const user = await User.findOne({ _id: id });
  if (!user) {
    res.json("User not found");
    return;
  } else {
    res.json(user.username);
  }
});

app.post("/addFriend", async (req, res) => {
  const friendName = req.body.friendName;
  const username = req.body.username;

  try {
    const user = await User.findOne({ username: username });

    if (!user) {
      res.json("User not found");
      return;
    }

    if (!friendName) {
      res.json("Friend name cannot be empty");
      return;
    }

    if (user.friends.includes(friendName)) {
      res.json("Friend already exists");
      return;
    }

    user.friends.push(friendName);
    await user.save();

    res.json("Friend added successfully");
  } catch (error) {
    res.json("Error adding friend");
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Running On Port {Not Shown}");
});
