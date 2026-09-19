const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");

const onlineUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.on("connection", async (socket) => {
    const user = socket.user;
    console.log(`🔌 ${user.username} connected (${socket.id})`);

    // Track online status
    onlineUsers.set(user._id.toString(), socket.id);
    await User.findByIdAndUpdate(user._id, { status: "online", lastSeen: new Date() });
    io.emit("user:status", { userId: user._id, status: "online" });

    // Join all user's rooms
    const userRooms = await Room.find({ members: user._id });
    userRooms.forEach((room) => socket.join(room._id.toString()));
    socket.emit("rooms:joined", userRooms.map((r) => r._id.toString()));

    // ── MESSAGES ──────────────────────────────────────────────

    socket.on("message:send", async ({ roomId, content, type = "text" }) => {
      try {
        const room = await Room.findOne({ _id: roomId, members: user._id });
        if (!room) return socket.emit("error", { message: "Access denied" });

        const message = await Message.create({
          content,
          sender: user._id,
          room: roomId,
          type,
        });

        await message.populate("sender", "username avatar");

        // Update room's last message
        await Room.findByIdAndUpdate(roomId, { lastMessage: message._id });

        io.to(roomId).emit("message:new", message);
      } catch (error) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("message:edit", async ({ messageId, content }) => {
      try {
        const message = await Message.findOne({ _id: messageId, sender: user._id });
        if (!message) return socket.emit("error", { message: "Message not found" });

        message.content = content;
        message.edited = true;
        message.editedAt = new Date();
        await message.save();
        await message.populate("sender", "username avatar");

        io.to(message.room.toString()).emit("message:updated", message);
      } catch (error) {
        socket.emit("error", { message: "Failed to edit message" });
      }
    });

    socket.on("message:delete", async ({ messageId }) => {
      try {
        const message = await Message.findOne({ _id: messageId, sender: user._id });
        if (!message) return socket.emit("error", { message: "Not authorized" });

        const roomId = message.room.toString();
        await message.deleteOne();

        io.to(roomId).emit("message:deleted", { messageId, roomId });
      } catch (error) {
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // ── TYPING ────────────────────────────────────────────────

    socket.on("typing:start", ({ roomId }) => {
      socket.to(roomId).emit("typing:update", {
        userId: user._id,
        username: user.username,
        roomId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", ({ roomId }) => {
      socket.to(roomId).emit("typing:update", {
        userId: user._id,
        username: user.username,
        roomId,
        isTyping: false,
      });
    });

    // ── ROOMS ─────────────────────────────────────────────────

    socket.on("room:join", async ({ roomId }) => {
      try {
        const room = await Room.findOne({ _id: roomId, members: user._id });
        if (!room) return socket.emit("error", { message: "Cannot join room" });

        socket.join(roomId);
        socket.emit("room:joined", { roomId });
      } catch (error) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // ── READ RECEIPTS ─────────────────────────────────────────

    socket.on("message:read", async ({ roomId }) => {
      try {
        await Message.updateMany(
          {
            room: roomId,
            "readBy.user": { $ne: user._id },
          },
          { $push: { readBy: { user: user._id, readAt: new Date() } } }
        );
        socket.to(roomId).emit("message:read", { userId: user._id, roomId });
      } catch (error) {
        console.error("Read receipt error:", error);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────

    socket.on("disconnect", async () => {
      console.log(`🔌 ${user.username} disconnected`);
      onlineUsers.delete(user._id.toString());

      await User.findByIdAndUpdate(user._id, {
        status: "offline",
        lastSeen: new Date(),
      });

      io.emit("user:status", {
        userId: user._id,
        status: "offline",
        lastSeen: new Date(),
      });
    });
  });
};
