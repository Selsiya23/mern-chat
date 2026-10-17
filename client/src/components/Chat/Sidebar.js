
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useSocket } from "../../context/SocketContext";
import "./Sidebar.css";
import axios from "axios";

export default function Sidebar() {
  const { user, logout } = useAuth();

  const {
    rooms,
    publicRooms,
    activeRoom,
    joinRoom,
    createRoom,
    joinPublicRoom,
    fetchRooms,
    fetchPublicRooms,
    openDirectChat,
  } = useChat();

  const { connected } = useSocket();

  const [showCreate, setShowCreate] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: "",
    description: "",
    isPrivate: false,
  });
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState("");

  const handleOpenDirectChat = async () => {
    setError("");

    try {
      const otherEmail =
        user?.email?.toLowerCase() === "jarvis@test.com"
          ? "zap@test.com"
          : "jarvis@test.com";

      const { data: users } = await axios.get(
        `/api/users/search?q=${encodeURIComponent(otherEmail)}`
      );

      const otherUser = users.find(
        (item) => item.email?.toLowerCase() === otherEmail
      );

      if (!otherUser) {
        setError("Other allowed account not found.");
        return;
      }

      const room = await openDirectChat(otherUser._id);
      await joinRoom(room);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to open direct chat."
      );
    }
  };


  const getAvatar = (name) => {
    const colors = [
      "#5865f2",
      "#57f287",
      "#fee75c",
      "#eb459e",
      "#ed4245",
      "#3ba55c",
    ];

    const idx = name?.charCodeAt(0) % colors.length;

    return {
      bg: colors[idx] || "#5865f2",
      letter: name?.[0]?.toUpperCase() || "?",
    };
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!newRoom.name.trim()) return;

    setCreating(true);
    setError("");

    try {
      const room = await createRoom(
        newRoom.name.trim(),
        newRoom.description.trim(),
        newRoom.isPrivate
      );

      setShowCreate(false);

      setNewRoom({
        name: "",
        description: "",
        isPrivate: false,
      });

      await joinRoom(room);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to create room."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (room) => {
    setJoiningId(room._id);
    setError("");

    try {
      const joinedRoom = await joinPublicRoom(room._id);
      await fetchRooms();
      await fetchPublicRooms();
      setShowDiscover(false);
      await joinRoom(joinedRoom);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to join room."
      );
    } finally {
      setJoiningId(null);
    }
  };

  const directRooms = rooms.filter((room) => room.type === "direct");
  const groupRooms = rooms.filter((room) => room.type === "group");

  const joinedIds = new Set(rooms.map((room) => room._id));

  const discoverRooms = publicRooms.filter(
    (room) =>
      !joinedIds.has(room._id) &&
      room.type === "group" &&
      room.isPrivate !== true
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span>💬</span>
          <span>ChatApp</span>
          <span
            className={`conn-dot ${connected ? "online" : "offline"}`}
            title={connected ? "Connected" : "Reconnecting..."}
          />
        </div>

        <button
          className="icon-btn"
          onClick={logout}
          title="Sign out"
        >
          ⏻
        </button>
      </div>

      <div className="sidebar-user">
        <div
          className="avatar sm"
          style={{ background: getAvatar(user?.username).bg }}
        >
          {getAvatar(user?.username).letter}
        </div>

        <div className="user-info">
          <span className="user-name">{user?.username}</span>
          <span className="user-email">{user?.email}</span>
        </div>
      </div>

      <div className="sidebar-rooms">
        <div className="room-section">
          <div className="section-header">
            <span>Rooms</span>

            <button
              className="icon-btn sm"
              onClick={() => {
                setError("");
                setShowCreate(true);
              }}
              title="Create room"
            >
              +
            </button>
          </div>

          {groupRooms.length > 0 ? (
            groupRooms.map((room) => (
              <RoomItem
                key={room._id}
                room={room}
                isActive={activeRoom?._id === room._id}
                onClick={() => joinRoom(room)}
                getAvatar={getAvatar}
              />
            ))
          ) : (
            <p className="empty-rooms">No joined rooms yet.</p>
          )}
        </div>

        <div className="room-section">
          <div className="section-header">
            <span>Direct messages</span>
            <button
              className="discover-button"
              onClick={handleOpenDirectChat}
            >
              Open {user?.email?.toLowerCase() === "jarvis@test.com" ? "Zap" : "Jarvis"} chat
            </button>
          </div>

          {directRooms.length > 0 ? (
            directRooms.map((room) => (
              <RoomItem
                key={room._id}
                room={room}
                isActive={activeRoom?._id === room._id}
                onClick={() => joinRoom(room)}
                getAvatar={getAvatar}
                isDirect
                currentUserId={user?._id}
              />
            ))
          ) : (
            <p className="empty-rooms">No direct messages yet.</p>
          )}
                    {error && <p className="room-error">{error}</p>}
        </div>

        <div className="room-section">
          <div className="section-header">
            <span>Discover Rooms</span>

            <button
              className="icon-btn sm"
              onClick={async () => {
                setError("");
                await fetchPublicRooms();
                setShowDiscover(true);
              }}
              title="Discover public rooms"
            >
              ↻
            </button>
          </div>

          <button
            className="discover-button"
            onClick={async () => {
              setError("");
              await fetchPublicRooms();
              setShowDiscover(true);
            }}
          >
            🌐 Find public rooms
          </button>
        </div>
      </div>

      {showCreate && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreate(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create a room</h3>

            {error && <p className="room-error">{error}</p>}

            <form onSubmit={handleCreate}>
              <input
                placeholder="Room name"
                value={newRoom.name}
                onChange={(e) =>
                  setNewRoom((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                required
                autoFocus
              />

              <input
                placeholder="Description (optional)"
                value={newRoom.description}
                onChange={(e) =>
                  setNewRoom((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newRoom.isPrivate}
                  onChange={(e) =>
                    setNewRoom((prev) => ({
                      ...prev,
                      isPrivate: e.target.checked,
                    }))
                  }
                />
                Private room
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDiscover && (
        <div
          className="modal-overlay"
          onClick={() => setShowDiscover(false)}
        >
          <div className="modal discover-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Discover public rooms</h3>

            {error && <p className="room-error">{error}</p>}

            {discoverRooms.length === 0 ? (
              <p className="empty-rooms">
                No public rooms available to join.
              </p>
            ) : (
              <div className="discover-list">
                {discoverRooms.map((room) => {
                  const avatar = getAvatar(room.name);

                  return (
                    <div className="discover-room" key={room._id}>
                      <div
                        className="avatar sm"
                        style={{ background: avatar.bg }}
                      >
                        {avatar.letter}
                      </div>

                      <div className="room-item-info">
                        <span className="room-name">{room.name}</span>
                        <span className="room-preview">
                          {room.description || "Public group room"}
                        </span>
                      </div>

                      <button
                        className="primary"
                        disabled={joiningId === room._id}
                        onClick={() => handleJoin(room)}
                      >
                        {joiningId === room._id ? "Joining..." : "Join"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setShowDiscover(false)}>
                Close
              </button>

              <button
                className="primary"
                onClick={() => fetchPublicRooms()}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomItem({
  room,
  isActive,
  onClick,
  getAvatar,
  isDirect,
  currentUserId,
}) {
  const otherMember = isDirect
    ? room.members?.find((member) => member._id !== currentUserId)
    : null;

  const displayName = isDirect
    ? otherMember?.username || "Direct message"
    : room.name;

  const { bg, letter } = getAvatar(displayName || "#");

  return (
    <button
      className={`room-item ${isActive ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="avatar sm" style={{ background: bg }}>
        {letter}
      </div>

      <div className="room-item-info">
        <span className="room-name">{displayName}</span>

        {room.lastMessage && (
          <span className="room-preview">
            {room.lastMessage.sender?.username}:{" "}
            {room.lastMessage.content}
          </span>
        )}
      </div>
    </button>
  );
}
