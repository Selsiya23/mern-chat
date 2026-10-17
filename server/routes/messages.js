
const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Room = require("../models/Room");
const { authenticate } = require("../middleware/auth");
const { isAllowedUser } = require("../config/allowedAccounts");

const router = express.Router();

// GET /api/messages/:roomId
// Only valid private one-to-one rooms are accessible.
router.get("/:roomId", authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 30)
    );

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    const room = await Room.findOne({
      _id: roomId,
      type: "direct",
      isPrivate: true,
      members: req.user._id,
      $expr: { $eq: [{ $size: "$members" }, 2] },
    }).populate("members", "username email");

    if (
      !room ||
      room.members.length !== 2 ||
      !room.members.every((member) => isAllowedUser(member))
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const filter = { room: room._id };

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .populate("sender", "username avatar")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Message.countDocuments(filter),
    ]);

    return res.json({
      messages: messages.reverse(),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get messages error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
