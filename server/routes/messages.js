const express = require("express");
const Message = require("../models/Message");
const Room = require("../models/Room");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// GET /api/messages/:roomId — paginated messages for a room
router.get("/:roomId", authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const room = await Room.findOne({ _id: req.params.roomId, members: req.user._id });
    if (!room) return res.status(403).json({ message: "Access denied" });

    const messages = await Message.find({ room: req.params.roomId })
      .populate("sender", "username avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Message.countDocuments({ room: req.params.roomId });

    res.json({
      messages: messages.reverse(),
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
