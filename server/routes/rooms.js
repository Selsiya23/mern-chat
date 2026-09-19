const express = require("express");
const Room = require("../models/Room");
const Message = require("../models/Message");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// GET /api/rooms — get all rooms for current user
router.get("/", authenticate, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id })
      .populate("members", "username avatar status")
      .populate("admin", "username avatar")
      .populate({ path: "lastMessage", populate: { path: "sender", select: "username" } })
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /api/rooms/public — get all public rooms
router.get("/public", authenticate, async (req, res) => {
  try {
    const rooms = await Room.find({ isPrivate: false, type: "group" })
      .populate("members", "username avatar status")
      .populate("admin", "username avatar")
      .sort({ createdAt: -1 });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/rooms — create a new room
router.post("/", authenticate, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    if (!name) return res.status(400).json({ message: "Room name required" });

    const room = await Room.create({
      name,
      description,
      isPrivate: isPrivate || false,
      admin: req.user._id,
      members: [req.user._id],
    });

    await room.populate("members", "username avatar status");
    await room.populate("admin", "username avatar");

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/rooms/:id/join — join a room
router.post("/:id/join", authenticate, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    if (room.members.includes(req.user._id)) {
      return res.status(400).json({ message: "Already a member" });
    }

    room.members.push(req.user._id);
    await room.save();

    await room.populate("members", "username avatar status");
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/rooms/:id/leave — leave a room
router.post("/:id/leave", authenticate, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    room.members = room.members.filter(
      (m) => m.toString() !== req.user._id.toString()
    );
    await room.save();

    res.json({ message: "Left room successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /api/rooms/direct/:userId — get or create a DM room
router.get("/direct/:userId", authenticate, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const members = [req.user._id, otherUserId].sort();

    let room = await Room.findOne({
      type: "direct",
      members: { $all: members, $size: 2 },
    }).populate("members", "username avatar status");

    if (!room) {
      room = await Room.create({
        name: "Direct Message",
        type: "direct",
        members,
        admin: req.user._id,
        isPrivate: true,
      });
      await room.populate("members", "username avatar status");
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
