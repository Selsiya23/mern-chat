
const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const { isAllowedUser } = require("../config/allowedAccounts");

const router = express.Router();

// GET /api/rooms - current user's valid private direct rooms
router.get("/", authenticate, async (req, res) => {
  try {
    const rooms = await Room.find({
      type: "direct",
      isPrivate: true,
      members: req.user._id,
    })
      .populate("members", "username avatar status email")
      .populate("admin", "username avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "username" },
      })
      .sort({ updatedAt: -1 });

    const safeRooms = rooms.filter(
      (room) =>
        room.members.length === 2 &&
        room.members.every((member) => isAllowedUser(member))
    );

    return res.json(safeRooms);
  } catch (error) {
    console.error("Get rooms error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// Public/group rooms are disabled
router.get("/public", authenticate, (req, res) => {
  return res.json([]);
});

// Group room creation is disabled
router.post("/", authenticate, (req, res) => {
  return res.status(403).json({
    message: "Only private one-to-one chats are allowed",
  });
});

// Joining rooms manually is disabled
router.post("/:id/join", authenticate, (req, res) => {
  return res.status(403).json({
    message: "Joining rooms manually is disabled",
  });
});

// Leaving a direct room is disabled to protect chat history
router.post("/:id/leave", authenticate, (req, res) => {
  return res.status(403).json({
    message: "Leaving direct chats is disabled",
  });
});

// GET /api/rooms/direct/:userId - find or create the allowed direct chat
router.get("/direct/:userId", authenticate, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (otherUserId === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot create a chat with yourself",
      });
    }

    const otherUser = await User.findById(otherUserId).select(
      "username email avatar status"
    );

    if (!otherUser || !isAllowedUser(otherUser)) {
      return res.status(403).json({
        message: "This chat account is not allowed",
      });
    }

    const members = [req.user._id, otherUser._id].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    let room = await Room.findOne({
      type: "direct",
      isPrivate: true,
      members: { $all: members, $size: 2 },
    }).populate("members", "username avatar status email");

    if (room) {
      const validRoom =
        room.members.length === 2 &&
        room.members.every((member) => isAllowedUser(member));

      if (!validRoom) {
        return res.status(403).json({
          message: "This chat room is not allowed",
        });
      }
    } else {
      room = await Room.create({
        name: "Direct Message",
        type: "direct",
        members,
        admin: req.user._id,
        isPrivate: true,
      });

      await room.populate("members", "username avatar status email");
    }

    return res.json(room);
  } catch (error) {
    console.error("Direct room error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
