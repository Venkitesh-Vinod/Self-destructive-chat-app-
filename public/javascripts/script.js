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

// App State
let userName = "Anonymous";
let hasAskedForName = false;
let currentRoom = null;
const chatHistory = {}; 
const roomTimers = {};
const localRoomKeys = {};    // Stores: { "roomName": "password" }
const roomValidations = {};  // Stores: { "roomName": "encryptedTokenFromServer" }

const VALIDATION_PHRASE = "VERIFY_ME";

// Helper: Format seconds to MM:SS
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `🕒 ${m}m ${s}s `;
}

// Global Timer Update
setInterval(() => {
  Object.keys(roomTimers).forEach(roomName => {
    if (roomTimers[roomName] > 0) {
      roomTimers[roomName]--;
      updateRoomUI(roomName);
    }
  });
}, 1000);

function updateRoomUI(roomName) {
  const timerElement = document.getElementById(`timer-${roomName}`);
  if (timerElement) {
    timerElement.textContent = formatTime(roomTimers[roomName]);
  }
}

// 1. CREATE ROOM (with Validation Token)
createRoomBtn.addEventListener("click", () => {
  const roomName = roomInput.value.trim();
  const ttlValue = parseInt(document.getElementById("ttl-input").value);

  if (ttlValue <= 0 ||ttlValue>=3600|| isNaN(ttlValue)) return alert("Enter a valid TTL value between 0 and 3600");
  if (!roomName) return alert("Enter Room name");

  const password = prompt(`Set a secret password for "${roomName}":`);
  if (!password || password.trim() === "") return alert("A password is required for E2EE.");

  // Create a token: Encrypt a fixed phrase with the password
  const validationToken = CryptoJS.AES.encrypt(VALIDATION_PHRASE, password).toString();
  
  // Store the password locally for the creator
  localRoomKeys[roomName] = password;

  socket.emit("create-room", { 
    roomName, 
    ttl: ttlValue, 
    validation: validationToken 
  });

  roomInput.value = "";
  document.getElementById("ttl-input").value = "";
});

// 2. JOIN ROOM (with Instant Validation)
function joinRoom(roomName) {
  if (currentRoom === roomName) return;
  
  if (!hasAskedForName) { 
    userName = prompt("What is your name?") || "Anonymous";
    hasAskedForName = true;
  }

  // If we don't have the password yet, ask and verify
  if (!localRoomKeys[roomName]) {
    const password = prompt(`Enter the secret password for "${roomName}":`);
    if (!password) return;

    const token = roomValidations[roomName];
    try {
      // Try to decrypt the server's token with the user's password
      const decrypted = CryptoJS.AES.decrypt(token, password).toString(CryptoJS.enc.Utf8);
      
      if (decrypted !== VALIDATION_PHRASE) {
        alert("❌ Incorrect Password! Access Denied.");
        return; // STOP: Do not join the room
      }
      
      // If we reach here, password is correct
      localRoomKeys[roomName] = password;
    } catch (e) {
      alert("❌ Invalid Password!");
      return;
    }
  }

  // UI Setup
  if (noChatSelected) noChatSelected.style.display = "none";
  if (activeChatArea) activeChatArea.style.display = "flex";

  currentRoom = roomName;
  if (!chatHistory[roomName]) chatHistory[roomName] = [];

  socket.emit("join-room", roomName);
  renderRooms();
  renderMessages();
}

// 3. SEND MESSAGE (Encrypted)
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentRoom || !localRoomKeys[currentRoom]) return;
  
  const message = messageInput.value.trim();
  const secret = localRoomKeys[currentRoom];

  if (message !== "") {
    const encryptedMessage = CryptoJS.AES.encrypt(message, secret).toString();

    socket.emit("send-chat-message", {
      room: currentRoom,
      name: userName,
      message: encryptedMessage
    });
    messageInput.value = "";
  }
});

// 4. RECEIVE MESSAGE (Decrypted)
socket.on("chat-message", data => {
  const roomName = data.room;
  if (!chatHistory[roomName]) chatHistory[roomName] = [];
  chatHistory[roomName].push(data);

  if (currentRoom === roomName) {
    appendMessage(data);
  } else {
    renderRooms(); 
  }
});

function appendMessage(data) {
  const messageElement = document.createElement('div');
  const isMe = data.id === socket.id;
  const secret = localRoomKeys[data.room];

  let displayedText = "[Encrypted Content]";
  
  if (secret) {
    try {
      const bytes = CryptoJS.AES.decrypt(data.message, secret);
      displayedText = bytes.toString(CryptoJS.enc.Utf8) || "[Decryption Error]";
    } catch (e) {
      displayedText = "[Decryption Error]";
    }
  }

  messageElement.className = `message ${isMe ? 'my-message' : 'other-message'}`;
  const nameColor = isMe ? '#fdff00' : getColorForUser(data.name);

  messageElement.innerHTML = `
    <span class="name" style="color:${nameColor};font-size:small;text-align:right;">
      ${isMe ? 'You' : data.name}
    </span>
    <div class="text">${displayedText}</div>
    <span class="time" style="text-align:right;">${data.time}</span>
  `;

  messageContainer.append(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// SOCKET LISTENERS
socket.on("initial-room-list", (serverRooms) => {
  Object.keys(serverRooms).forEach(name => {
    chatHistory[name] = [];
    roomTimers[name] = serverRooms[name].ttl;
    roomValidations[name] = serverRooms[name].validation; // Save validation token
  });
  renderRooms();
});

socket.on("new-room-created", ({ roomName, ttl, validation }) => {
  if (!chatHistory[roomName]) {
    chatHistory[roomName] = [];
    roomTimers[roomName] = ttl;
    roomValidations[roomName] = validation; // Save validation token
    renderRooms();
  }
});

socket.on("room-destroyed-globally", (roomName) => {
  delete chatHistory[roomName];
  delete roomTimers[roomName];
  delete localRoomKeys[roomName];
  delete roomValidations[roomName];
  
  if (currentRoom === roomName) {
    currentRoom = null;
    activeChatArea.style.display = "none";
    noChatSelected.style.display = "flex";
    alert(`Room ${roomName} has SELF DESTRUCTED !`);
  }
  renderRooms();
});

leaveBtn.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("leave-room", currentRoom);
  delete localRoomKeys[currentRoom]; // Forget password on leave
  currentRoom = null; 
  activeChatArea.style.display = "none";
  noChatSelected.style.display = "flex";
  renderRooms();
});

function renderRooms() {
  roomList.innerHTML = "";
  Object.keys(chatHistory).forEach(room => {
    const div = document.createElement("div");
    div.className = "room-item" + (room === currentRoom ? " active" : "");
    
    const nameSpan = document.createElement("span");
    nameSpan.textContent = room;
    const timeSpan = document.createElement("span");
    timeSpan.className = "rem-time";
    timeSpan.id = `timer-${room}`;
    timeSpan.style.fontSize = "x-small";
    timeSpan.style.display = "block"; 
    timeSpan.textContent = formatTime(roomTimers[room]);

    div.appendChild(nameSpan);
    div.appendChild(timeSpan);
    
    if (room !== currentRoom) {
      div.onclick = () => joinRoom(room);
    }
    roomList.appendChild(div);
  });
}

function renderMessages() {
  messageContainer.innerHTML = "";
  const messages = chatHistory[currentRoom] || [];
  messages.forEach(msg => appendMessage(msg));
}

function getColorForUser(name) {
  const colors = ['#f687b3', '#b17fff', '#ed8936', '#a5c7d1', '#008080', '#d929ff', '#7479f5', '#0cf1ac', '#05a22b', '#fbd38d', '#ff4949', '#f3820a', '#fc8181', '#38b2ac'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}