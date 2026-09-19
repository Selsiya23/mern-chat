import React from "react";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import "./ChatPage.css";

export default function ChatPage() {
  return (
    <div className="chat-layout">
      <Sidebar />
      <ChatWindow />
    </div>
  );
}
