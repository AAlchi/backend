const mongoose = require("mongoose");

// Define the schema for your model
const userSchema = new mongoose.Schema({
  fullName: { type: String },
  username: { type: String },
  email: { type: String },
  password: { type: String },
  image: { type: String },
  friends: { type: Array },
});

// Create the model using the schema
const User = mongoose.model("User", userSchema);

module.exports = User;
