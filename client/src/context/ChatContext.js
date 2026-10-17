
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, on, off } = useSocket();

  const [rooms, setRooms] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch rooms joined by current user
  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/rooms");
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  }, []);

  // Fetch all public group rooms
  const fetchPublicRooms = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/rooms/public");
      setPublicRooms(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch public rooms:", error);
      return [];
    }
  }, []);

  // Fetch messages for a room
  const fetchMessages = useCallback(async (roomId, page = 1) => {
    try {
      setLoading(true);

      const { data } = await axios.get(
        `/api/messages/${roomId}?page=${page}&limit=30`
      );

      setMessages((prev) => ({
        ...prev,
        [roomId]:
          page === 1
            ? data.messages
            : [...data.messages, ...(prev[roomId] || [])],
      }));

      return data;
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Open a room
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

  // Send message
  const sendMessage = useCallback(
    (content) => {
      if (!activeRoom || !content.trim()) return;

      socket?.emit("message:send", {
        roomId: activeRoom._id,
        content: content.trim(),
      });
    },
    [socket, activeRoom]
  );

  // Create a room
  const createRoom = useCallback(
    async (name, description, isPrivate) => {
      const { data } = await axios.post("/api/rooms", {
        name,
        description,
        isPrivate,
      });

      setRooms((prev) => [
        data,
        ...prev.filter((room) => room._id !== data._id),
      ]);

      await fetchPublicRooms();

      return data;
    },
    [fetchPublicRooms]
  );

    // Open or create a direct chat with another allowed user
  const openDirectChat = useCallback(
    async (userId) => {
      const { data } = await axios.get(`/api/rooms/direct/${userId}`);

      setRooms((prev) => [
        data,
        ...prev.filter((room) => room._id !== data._id),
      ]);

      return data;
    },
    []
  );

  // Join a public room
  const joinPublicRoom = useCallback(
    async (roomId) => {
      try {
        const { data } = await axios.post(`/api/rooms/${roomId}/join`);

        setRooms((prev) => [
          data,
          ...prev.filter((room) => room._id !== data._id),
        ]);

        await fetchPublicRooms();

        return data;
      } catch (error) {
        console.error(
          "Failed to join public room:",
          error.response?.data || error.message
        );
        throw error;
      }
    },
    [fetchPublicRooms]
  );

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (message) => {
      setMessages((prev) => ({
        ...prev,
        [message.room]: [
          ...(prev[message.room] || []),
          message,
        ],
      }));

      setRooms((prev) =>
        prev
          .map((room) =>
            room._id === message.room
              ? {
                  ...room,
                  lastMessage: message,
                  updatedAt: new Date().toISOString(),
                }
              : room
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt) - new Date(a.updatedAt)
          )
      );
    };

    const onMessageUpdated = (message) => {
      setMessages((prev) => ({
        ...prev,
        [message.room]: (prev[message.room] || []).map((item) =>
          item._id === message._id ? message : item
        ),
      }));
    };

    const onMessageDeleted = ({ messageId, roomId }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter(
          (message) => message._id !== messageId
        ),
      }));
    };

    const onTypingUpdate = ({ userId, username, roomId, isTyping }) => {
      if (userId === user?._id) return;

      setTypingUsers((prev) => ({
        ...prev,
        [roomId]: isTyping
          ? {
              ...prev[roomId],
              [userId]: username,
            }
          : Object.fromEntries(
              Object.entries(prev[roomId] || {}).filter(
                ([id]) => id !== userId
              )
            ),
      }));
    };

    const onUserStatus = ({ userId, status }) => {
      setOnlineUsers((prev) => ({
        ...prev,
        [userId]: status,
      }));
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

  // Load rooms when user logs in
  useEffect(() => {
    if (user) {
      fetchRooms();
      fetchPublicRooms();
    } else {
      setRooms([]);
      setPublicRooms([]);
      setActiveRoom(null);
      setMessages({});
    }
  }, [user, fetchRooms, fetchPublicRooms]);

  return (
    <ChatContext.Provider
      value={{
        rooms,
        publicRooms,
        activeRoom,
        messages,
        typingUsers,
        onlineUsers,
        loading,
        joinRoom,
        openDirectChat,
        sendMessage,
        createRoom,
        joinPublicRoom,
        fetchRooms,
        fetchPublicRooms,
        fetchMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);

  if (!ctx) {
    throw new Error("useChat must be used within ChatProvider");
  }

  return ctx;
};
