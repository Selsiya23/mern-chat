import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, on, off } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch user's rooms
  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/rooms");
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  }, []);

  // Fetch messages for a room
  const fetchMessages = useCallback(async (roomId, page = 1) => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/messages/${roomId}?page=${page}&limit=30`);
      setMessages((prev) => ({
        ...prev,
        [roomId]: page === 1 ? data.messages : [...data.messages, ...(prev[roomId] || [])],
      }));
      return data;
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Join a room
  const joinRoom = useCallback(
    async (room) => {
      setActiveRoom(room);
      if (!messages[room._id]) {
        await fetchMessages(room._id);
      }
      socket?.emit("room:join", { roomId: room._id });
      socket?.emit("message:read", { roomId: room._id });
    },
    [socket, messages, fetchMessages]
  );

  // Send a message
  const sendMessage = useCallback(
    (content) => {
      if (!activeRoom || !content.trim()) return;
      socket?.emit("message:send", { roomId: activeRoom._id, content: content.trim() });
    },
    [socket, activeRoom]
  );

  // Create a room
  const createRoom = useCallback(async (name, description, isPrivate) => {
    const { data } = await axios.post("/api/rooms", { name, description, isPrivate });
    setRooms((prev) => [data, ...prev]);
    return data;
  }, []);

  // Join a public room
  const joinPublicRoom = useCallback(async (roomId) => {
    const { data } = await axios.post(`/api/rooms/${roomId}/join`);
    setRooms((prev) => [data, ...prev.filter((r) => r._id !== roomId)]);
    return data;
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (message) => {
      setMessages((prev) => ({
        ...prev,
        [message.room]: [...(prev[message.room] || []), message],
      }));
      setRooms((prev) =>
        prev.map((r) =>
          r._id === message.room
            ? { ...r, lastMessage: message, updatedAt: new Date().toISOString() }
            : r
        ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
    };

    const onMessageUpdated = (message) => {
      setMessages((prev) => ({
        ...prev,
        [message.room]: (prev[message.room] || []).map((m) =>
          m._id === message._id ? message : m
        ),
      }));
    };

    const onMessageDeleted = ({ messageId, roomId }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter((m) => m._id !== messageId),
      }));
    };

    const onTypingUpdate = ({ userId, username, roomId, isTyping }) => {
      if (userId === user?._id) return;
      setTypingUsers((prev) => ({
        ...prev,
        [roomId]: isTyping
          ? { ...prev[roomId], [userId]: username }
          : Object.fromEntries(
              Object.entries(prev[roomId] || {}).filter(([k]) => k !== userId)
            ),
      }));
    };

    const onUserStatus = ({ userId, status }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: status }));
    };

    on("message:new", onNewMessage);
    on("message:updated", onMessageUpdated);
    on("message:deleted", onMessageDeleted);
    on("typing:update", onTypingUpdate);
    on("user:status", onUserStatus);

    return () => {
      off("message:new", onNewMessage);
      off("message:updated", onMessageUpdated);
      off("message:deleted", onMessageDeleted);
      off("typing:update", onTypingUpdate);
      off("user:status", onUserStatus);
    };
  }, [socket, on, off, user]);

  useEffect(() => {
    if (user) fetchRooms();
  }, [user, fetchRooms]);

  return (
    <ChatContext.Provider
      value={{
        rooms,
        activeRoom,
        messages,
        typingUsers,
        onlineUsers,
        loading,
        joinRoom,
        sendMessage,
        createRoom,
        joinPublicRoom,
        fetchRooms,
        fetchMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};
