
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");
const { isAllowedUser } = require("../config/allowedAccounts");

const onlineUsers = new Map();

module.exports = (io) => {
  io.on("connection", async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();

    try {
      // Verify the connected account is still allowed.
      const currentUser = await User.findById(user._id);

      if (!currentUser || !isAllowedUser(currentUser)) {
        return socket.disconnect(true);
      }

      console.log(`${user.username} connected (${socket.id})`);

      onlineUsers.set(userId, socket.id);

      await User.findByIdAndUpdate(user._id, {
        status: "online",
        lastSeen: new Date(),
      });

      io.emit("user:status", {
        userId: user._id,
        status: "online",
      });

      // Join only valid private direct rooms with two allowed members.
      const userRooms = await Room.find({
        type: "direct",
        isPrivate: true,
        members: user._id,
        $expr: { $eq: [{ $size: "$members" }, 2] },
      }).populate("members", "username email");

      const validRooms = userRooms.filter(
        (room) =>
          room.members.length === 2 &&
          room.members.every((member) => isAllowedUser(member))
      );

      validRooms.forEach((room) => socket.join(room._id.toString()));

      socket.emit(
        "rooms:joined",
        validRooms.map((room) => room._id.toString())
      );
    } catch (error) {
      console.error("Socket connection setup error:", error.message);
      return socket.disconnect(true);
    }

    // Always verify room membership and direct-chat restrictions.
    const getValidRoom = async (roomId) => {
      if (!mongoose.Types.ObjectId.isValid(roomId)) return null;

      const room = await Room.findOne({
        _id: roomId,
        type: "direct",
        isPrivate: true,
        members: user._id,
        $expr: { $eq: [{ $size: "$members" }, 2] },
      }).populate("members", "username email");

      if (
        !room ||
        room.members.length !== 2 ||
        !room.members.every((member) => isAllowedUser(member))
      ) {
        return null;
      }

      return room;
    };

    // SEND MESSAGE
    socket.on("message:send", async (payload = {}) => {
      try {
        const { roomId, content, type = "text" } = payload || {};

        if (
          typeof content !== "string" ||
          !content.trim() ||
          content.length > 2000 ||
          !["text", "image"].includes(type)
        ) {
          return socket.emit("error", {
            message: "Invalid message content or type",
          });
        }

        const room = await getValidRoom(roomId);

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        const message = await Message.create({
          content: content.trim(),
          sender: user._id,
          room: room._id,
          type,
        });

        await message.populate("sender", "username avatar");

        await Room.findByIdAndUpdate(room._id, {
          lastMessage: message._id,
        });

        io.to(room._id.toString()).emit("message:new", message);
      } catch (error) {
        console.error("Message send error:", error.message);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // EDIT OWN MESSAGE
    socket.on("message:edit", async (payload = {}) => {
      try {
        const { messageId, content } = payload || {};

        if (
          !mongoose.Types.ObjectId.isValid(messageId) ||
          typeof content !== "string" ||
          !content.trim() ||
          content.length > 2000
        ) {
          return socket.emit("error", { message: "Invalid edit request" });
        }

        const message = await Message.findOne({
          _id: messageId,
          sender: user._id,
        });

        if (!message) {
          return socket.emit("error", { message: "Message not found" });
        }

        const room = await getValidRoom(message.room.toString());

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        message.content = content.trim();
        message.edited = true;
        message.editedAt = new Date();

        await message.save();
        await message.populate("sender", "username avatar");

        io.to(room._id.toString()).emit("message:updated", message);
      } catch (error) {
        console.error("Message edit error:", error.message);
        socket.emit("error", { message: "Failed to edit message" });
      }
    });

    // DELETE OWN MESSAGE
    socket.on("message:delete", async (payload = {}) => {
      try {
        const { messageId } = payload || {};

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return socket.emit("error", { message: "Invalid message ID" });
        }

        const message = await Message.findOne({
          _id: messageId,
          sender: user._id,
        });

        if (!message) {
          return socket.emit("error", { message: "Not authorized" });
        }

        const room = await getValidRoom(message.room.toString());

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        const roomId = room._id.toString();

        await message.deleteOne();

        io.to(roomId).emit("message:deleted", {
          messageId: messageId.toString(),
          roomId,
        });
      } catch (error) {
        console.error("Message delete error:", error.message);
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // TYPING EVENTS
    socket.on("typing:start", async (payload = {}) => {
      try {
        const room = await getValidRoom(payload?.roomId);

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        socket.to(room._id.toString()).emit("typing:update", {
          userId: user._id,
          username: user.username,
          roomId: room._id.toString(),
          isTyping: true,
        });
      } catch (error) {
        socket.emit("error", { message: "Typing update failed" });
      }
    });

    socket.on("typing:stop", async (payload = {}) => {
      try {
        const room = await getValidRoom(payload?.roomId);

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        socket.to(room._id.toString()).emit("typing:update", {
          userId: user._id,
          username: user.username,
          roomId: room._id.toString(),
          isTyping: false,
        });
      } catch (error) {
        socket.emit("error", { message: "Typing update failed" });
      }
    });

    // ROOM JOIN
    socket.on("room:join", async (payload = {}) => {
      try {
        const room = await getValidRoom(payload?.roomId);

        if (!room) {
          return socket.emit("error", { message: "Cannot join room" });
        }

        socket.join(room._id.toString());

        socket.emit("room:joined", {
          roomId: room._id.toString(),
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // READ RECEIPTS
    socket.on("message:read", async (payload = {}) => {
      try {
        const room = await getValidRoom(payload?.roomId);

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        await Message.updateMany(
          {
            room: room._id,
            sender: { $ne: user._id },
            "readBy.user": { $ne: user._id },
          },
          {
            $push: {
              readBy: {
                user: user._id,
                readAt: new Date(),
              },
            },
          }
        );

        socket.to(room._id.toString()).emit("message:read", {
          userId: user._id,
          roomId: room._id.toString(),
        });
      } catch (error) {
        console.error("Read receipt error:", error.message);
      }
    });

    // DISCONNECT
    socket.on("disconnect", async () => {
      console.log(`${user.username} disconnected`);

      // Don't mark the user offline if another socket is still connected.
      if (onlineUsers.get(userId) !== socket.id) return;

      onlineUsers.delete(userId);

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
