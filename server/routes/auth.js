
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const {
  normalizeEmail,
  isAllowedEmail,
} = require("../config/allowedAccounts");

const router = express.Router();

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

const validRegistrationKey = (providedKey) => {
  const expectedKey = process.env.CHAT_REGISTRATION_KEY;

  if (
    typeof providedKey !== "string" ||
    typeof expectedKey !== "string" ||
    !expectedKey ||
    Buffer.byteLength(providedKey) !== Buffer.byteLength(expectedKey)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(providedKey),
    Buffer.from(expectedKey)
  );
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    if (process.env.CHAT_REGISTRATION_ENABLED !== "true") {
      return res.status(403).json({
        message: "Registration is disabled",
      });
    }

    if (!validRegistrationKey(req.body.registrationKey)) {
      return res.status(403).json({
        message: "Invalid registration key",
      });
    }

    const { username, password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (
      typeof username !== "string" ||
      !username.trim() ||
      typeof password !== "string" ||
      !password ||
      !email
    ) {
      return res.status(400).json({
        message: "Username, email and password are required",
      });
    }

    if (!isAllowedEmail(email)) {
      return res.status(403).json({
        message: "This email is not allowed",
      });
    }

    const cleanUsername = username.trim();

    const existingUser = await User.findOne({
      $or: [{ email }, { username: cleanUsername }],
    });

    if (existingUser) {
      return res.status(409).json({
        message:
          existingUser.email === email
            ? "Email already in use"
            : "Username already taken",
      });
    }

    const user = await User.create({
      username: cleanUsername,
      email,
      password,
    });

    const token = generateToken(user._id);

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error("Registration error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    if (!isAllowedEmail(email)) {
      return res.status(403).json({
        message: "This email is not allowed",
      });
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    return res.json({ token, user });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
