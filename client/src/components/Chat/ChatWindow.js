import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useSocket } from "../../context/SocketContext";
import { format, isToday, isYesterday } from "date-fns";
import "./ChatWindow.css";

export default function ChatWindow() {
  const { user } = useAuth();
  const { activeRoom, messages, typingUsers, sendMessage } = useChat();
  const { emit } = useSocket();
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimer = useRef(null);

  const roomMessages = messages[activeRoom?._id] || [];
  const roomTypers = typingUsers[activeRoom?._id] || {};
  const typerList = Object.values(roomTypers);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomMessages]);

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!activeRoom) return;

    if (!isTyping) {
      setIsTyping(true);
      emit("typing:start", { roomId: activeRoom._id });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      emit("typing:stop", { roomId: activeRoom._id });
    }, 1500);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText("");
    clearTimeout(typingTimer.current);
    setIsTyping(false);
    if (activeRoom) emit("typing:stop", { roomId: activeRoom._id });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
    return format(d, "MMM d, h:mm a");
  };

  const getAvatar = (name) => {
    const colors = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#3ba55c"];
    const idx = name?.charCodeAt(0) % colors.length;
    return { bg: colors[idx] || "#5865f2", letter: name?.[0]?.toUpperCase() || "?" };
  };

  if (!activeRoom) {
    return (
      <div className="chat-empty">
        <div className="chat-empty-icon">💬</div>
        <h2>Pick a room to start chatting</h2>
        <p>Select a room from the sidebar or create a new one.</p>
      </div>
    );
  }

  // Group consecutive messages from same sender
  const grouped = roomMessages.reduce((acc, msg, i) => {
    const prev = roomMessages[i - 1];
    const isFirst =
      !prev ||
      prev.sender?._id !== msg.sender?._id ||
      new Date(msg.createdAt) - new Date(prev.createdAt) > 5 * 60 * 1000;
    acc.push({ ...msg, isFirst });
    return acc;
  }, []);

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="chat-hash">{activeRoom.type === "group" ? "#" : "✉"}</span>
          <div>
            <h2>{activeRoom.name}</h2>
            {activeRoom.description && <p>{activeRoom.description}</p>}
          </div>
        </div>
        <div className="chat-header-meta">
          {activeRoom.members?.length} member{activeRoom.members?.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {grouped.length === 0 && (
          <div className="messages-empty">
            No messages yet. Be the first to say something!
          </div>
        )}

        {grouped.map((msg) => {
          const isMine = msg.sender?._id === user?._id;
          const { bg, letter } = getAvatar(msg.sender?.username);
          return (
            <div key={msg._id} className={`message ${isMine ? "mine" : ""} ${msg.isFirst ? "first" : ""}`}>
              {msg.isFirst && !isMine && (
                <div className="avatar sm" style={{ background: bg }}>{letter}</div>
              )}
              {!msg.isFirst && !isMine && <div className="msg-spacer" />}
              <div className="message-body">
                {msg.isFirst && (
                  <div className="message-meta">
                    <span className="msg-author">{isMine ? "You" : msg.sender?.username}</span>
                    <span className="msg-time">{formatDate(msg.createdAt)}</span>
                    {msg.edited && <span className="msg-edited">(edited)</span>}
                  </div>
                )}
                <div className="message-bubble">{msg.content}</div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typerList.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            <span className="typing-text">
              {typerList.join(", ")} {typerList.length === 1 ? "is" : "are"} typing…
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="chat-input-bar" onSubmit={handleSend}>
        <input
          value={text}
          onChange={handleTyping}
          placeholder={`Message #${activeRoom.name}`}
          autoFocus
        />
        <button type="submit" disabled={!text.trim()}>
          Send ↑
        </button>
      </form>
    </div>
  );
}
