
const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const { isAllowedUser } = require("../config/allowedAccounts");

const router = express.Router();

// GET /api/users/search?q=query
router.get("/search", authenticate, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!q) return res.json([]);

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
      _id: { $ne: req.user._id },
    })
      .select("username email avatar status")
      .limit(10);

    return res.json(users.filter(isAllowedUser));
  } catch (error) {
    console.error("User search error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/:id
router.get("/:id", authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id).select(
      "username email avatar status lastSeen"
    );

    if (!user || !isAllowedUser(user)) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get user error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
