const socket = io();

// UI Elements
const messageForm = document.getElementById("send-container");
const messageInput = document.getElementById("message-input");
const messageContainer = document.getElementById("message-container");
const roomList = document.getElementById("room-list");
const roomInput = document.getElementById("room-input");
const createRoomBtn = document.getElementById("create-room-btn");
const activeChatArea = document.getElementById("active-chat-area");
const noChatSelected = document.getElementById("no-chat-selected");
const leaveBtn = document.getElementById("leave-room-btn");
const roomTimers = {};

// App State
let userName = "Anonymous";
let hasAskedForName = false; // Tracking variable
let currentRoom = null;
const chatHistory = {}; // Stores { "roomName": [messageObjects] }

setInterval(() => {
  Object.keys(roomTimers).forEach(roomName => {
    if (roomTimers[roomName] > 0) {
      roomTimers[roomName]--;
      updateRoomUI(roomName);
    }  });
}, 1000);

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `🕒 ${m}m ${s}s `;
}

createRoomBtn.addEventListener("click", () => {
    const roomName = roomInput.value.trim();
    const ttlValue = parseInt(document.getElementById("ttl-input").value);

    if (!roomName ||ttlValue<=0||isNaN(ttlValue)) return;
    
    // 1. Tell the server to create the room for EVERYONE
    // This triggers the 'new-room-created' event for all clients
    socket.emit("create-room", { roomName, ttl: ttlValue });

    roomInput.value = "";
    document.getElementById("ttl-input").value = "";
});


function joinRoom(roomName) {
  if (currentRoom === roomName) return;
  
  if (!hasAskedForName) { 
    userName = prompt("What is your name?") || "Anonymous";
    hasAskedForName = true;
    }

  // UI Switch: Show chat, hide placeholder
  if (noChatSelected) noChatSelected.style.display = "none";
  if (activeChatArea) activeChatArea.style.display = "flex";

  currentRoom = roomName;

  // Initialize history for the room if it's new
  if (!chatHistory[roomName]) {
    chatHistory[roomName] = [];
  }

  socket.emit("join-room",roomName);
  renderRooms();
  renderMessages(); // Refresh the message container for this room
}


function renderRooms() {
  roomList.innerHTML = "";
  Object.keys(chatHistory).forEach(room => {
    const div = document.createElement("div");
    div.className = "room-item" + (room === currentRoom ? " active" : "");
    
    // Room Name
    const nameSpan = document.createElement("span");
    nameSpan.textContent = room;
    const timeSpan = document.createElement("span");
    timeSpan.className="rem-time";
    timeSpan.id = `timer-${room}`;
    timeSpan.style.fontSize = "x-small";
    timeSpan.style.display = "block"; 
    timeSpan.textContent = formatTime(roomTimers[room]);

    div.appendChild(nameSpan);
    div.appendChild(timeSpan);
    
    if(room!=currentRoom){
    div.onclick = () => joinRoom(room); }
    roomList.appendChild(div);
  });
}

function updateRoomUI(roomName) {
  const timerElement = document.getElementById(`timer-${roomName}`);
  if (timerElement) {
    timerElement.textContent = formatTime(roomTimers[roomName]);
  }
}

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentRoom) return;
  
  const message = messageInput.value.trim();
  if (message !== "") {
    socket.emit("send-chat-message", {
      room: currentRoom,
      name: userName,
      message: message
    });
    messageInput.value = "";
  }
});

leaveBtn.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("leave-room", currentRoom);
  currentRoom = null; 
  activeChatArea.style.display = "none";
  noChatSelected.style.display = "flex";
  renderRooms();
});

socket.on("initial-room-list", (serverRooms) => {
  Object.keys(serverRooms).forEach(name => {
    chatHistory[name] = [];
    roomTimers[name] = serverRooms[name].ttl;
  });
  renderRooms();
});

socket.on("new-room-created", ({ roomName, ttl }) => {
  if (!chatHistory[roomName]) {
    chatHistory[roomName] = [];
    roomTimers[roomName] = ttl;
    renderRooms();
  }
});

socket.on("room-destroyed-globally", (roomName) => {
  delete chatHistory[roomName];
  delete roomTimers[roomName];
  
  if (currentRoom === roomName) {
    currentRoom = null;
    activeChatArea.style.display = "none";
    noChatSelected.style.display = "flex";
    alert(`Room ${roomName} has SELF DESTRUCTED !`);
  }
  renderRooms();
});

socket.on("chat-message", data => {
  // 1. Store the message in the correct room history
  const roomName = data.room;
  if (!chatHistory[roomName]) {
    chatHistory[roomName] = [];
  }
  chatHistory[roomName].push(data);

  // 2. Only show on screen if it's the room we are currently looking at
  if (currentRoom === roomName) {
    appendMessage(data);
  } else {
    // Optional: Add a visual notification to the room in the sidebar
    renderRooms(); 
  }
});

function renderMessages() {
  messageContainer.innerHTML = "";
  const messages = chatHistory[currentRoom] || [];
  messages.forEach(msg => appendMessage(msg));
}

function appendMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');

  const isMe = data.name === userName;
  messageElement.classList.add(isMe ? 'my-message' : 'other-message');

  const nameColor = isMe ? '#fdff00' : getColorForUser(data.name);

  messageElement.innerHTML = `
    <span class="name" style="color:${nameColor};font-size:small;text-align:right;">
      ${isMe ? 'You' : data.name}
    </span>
    <div class="text">${data.message}</div>
    <span class="time" style="text-align:right;">${data.time}</span>
  `;

  messageContainer.append(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function getColorForUser(name) {
  const colors = ['#f687b3', '#634a8a', '#ed8936', '#2d3436', '#008080', '#1a3a5f', '#2c5282', '#003366', '#48bb78', '#fbd38d', '#71287e', '#ecc94b', '#fc8181', '#38b2ac'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
