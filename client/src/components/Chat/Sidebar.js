import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useSocket } from "../../context/SocketContext";
import { format } from "date-fns";
import "./Sidebar.css";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { rooms, activeRoom, joinRoom, createRoom } = useChat();
  const { connected } = useSocket();
  const [showCreate, setShowCreate] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", description: "", isPrivate: false });
  const [creating, setCreating] = useState(false);

  const getAvatar = (name) => {
    const colors = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#3ba55c"];
    const idx = name?.charCodeAt(0) % colors.length;
    return { bg: colors[idx] || "#5865f2", letter: name?.[0]?.toUpperCase() || "?" };
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newRoom.name.trim()) return;
    setCreating(true);
    try {
      const room = await createRoom(newRoom.name, newRoom.description, newRoom.isPrivate);
      joinRoom(room);
      setShowCreate(false);
      setNewRoom({ name: "", description: "", isPrivate: false });
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const directRooms = rooms.filter((r) => r.type === "direct");
  const groupRooms = rooms.filter((r) => r.type === "group");

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span>💬</span>
          <span>ChatApp</span>
          <span className={`conn-dot ${connected ? "online" : "offline"}`} title={connected ? "Connected" : "Reconnecting..."} />
        </div>
        <button className="icon-btn" onClick={logout} title="Sign out">⏻</button>
      </div>

      {/* User info */}
      <div className="sidebar-user">
        <div className="avatar sm" style={{ background: getAvatar(user?.username).bg }}>
          {getAvatar(user?.username).letter}
        </div>
        <div className="user-info">
          <span className="user-name">{user?.username}</span>
          <span className="user-email">{user?.email}</span>
        </div>
      </div>

      {/* Room list */}
      <div className="sidebar-rooms">
        {groupRooms.length > 0 && (
          <div className="room-section">
            <div className="section-header">
              <span>Rooms</span>
              <button className="icon-btn sm" onClick={() => setShowCreate(true)} title="Create room">+</button>
            </div>
            {groupRooms.map((room) => (
              <RoomItem
                key={room._id}
                room={room}
                isActive={activeRoom?._id === room._id}
                onClick={() => joinRoom(room)}
                getAvatar={getAvatar}
              />
            ))}
          </div>
        )}

        {directRooms.length > 0 && (
          <div className="room-section">
            <div className="section-header"><span>Direct messages</span></div>
            {directRooms.map((room) => (
              <RoomItem
                key={room._id}
                room={room}
                isActive={activeRoom?._id === room._id}
                onClick={() => joinRoom(room)}
                getAvatar={getAvatar}
                isDirect
                currentUserId={user?._id}
              />
            ))}
          </div>
        )}

        {rooms.length === 0 && (
          <div className="empty-rooms">
            <p>No rooms yet.</p>
            <button onClick={() => setShowCreate(true)}>Create your first room</button>
          </div>
        )}
      </div>

      {/* Create room modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create a room</h3>
            <form onSubmit={handleCreate}>
              <input
                placeholder="Room name"
                value={newRoom.name}
                onChange={(e) => setNewRoom((p) => ({ ...p, name: e.target.value }))}
                required
                autoFocus
              />
              <input
                placeholder="Description (optional)"
                value={newRoom.description}
                onChange={(e) => setNewRoom((p) => ({ ...p, description: e.target.value }))}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newRoom.isPrivate}
                  onChange={(e) => setNewRoom((p) => ({ ...p, isPrivate: e.target.checked }))}
                />
                Private room
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="primary" disabled={creating}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomItem({ room, isActive, onClick, getAvatar, isDirect, currentUserId }) {
  const otherMember = isDirect
    ? room.members?.find((m) => m._id !== currentUserId)
    : null;
  const displayName = isDirect ? otherMember?.username : room.name;
  const { bg, letter } = getAvatar(displayName || "#");

  return (
    <button className={`room-item ${isActive ? "active" : ""}`} onClick={onClick}>
      <div className="avatar sm" style={{ background: bg }}>{letter}</div>
      <div className="room-item-info">
        <span className="room-name">{displayName}</span>
        {room.lastMessage && (
          <span className="room-preview">
            {room.lastMessage.sender?.username}: {room.lastMessage.content}
          </span>
        )}
      </div>
    </button>
  );
}
