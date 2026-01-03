# Self-Destructing Encrypted Chat Rooms

This project is a real-time chat application built using Node.js, Express, and Socket.IO.
Chat rooms automatically expire after a fixed time (TTL), and all messages are protected
using End-to-End Encryption (E2EE).

The application does not use any persistent database and relies entirely on in-memory storage.

---

## Problem Statement

Build a chat application that:
- Supports real-time bi-directional communication
- Uses no persistent database
- Automatically destroys rooms after a given lifetime
- Disconnects users when a room expires
- Implements End-to-End Encryption as a bonus feature

---

## Key Features

- Real-time messaging using Socket.IO
- Time-To-Live (TTL) based chat rooms
- Automatic room self-destruction after TTL expiry
- Password-protected End-to-End Encrypted messaging
- In-memory storage for rooms, timers, and validation tokens
- Instant password validation before joining rooms
- Server never sees plaintext messages
- Client-side encryption and decryption

---

## Tech Stack

- Node.js
- Express.js (generated using express-generator)
- Socket.IO
- Handlebars (hbs)
- CryptoJS (AES encryption)
- HTML, CSS, JavaScript

---

## Project Structure

├── bin/
│ └── www
├── public/
│ ├── javascripts/
│ │ └── script.js
│ └── stylesheets/
│ └── style.css
├── routes/
│ └── index.js
├── views/
│ ├── layout.hbs
│ └── index.hbs
├── app.js
├── package.json
└── README.md

---

## How the Application Works

### Room Creation
- User enters a room name and TTL value
- User sets a secret password for the room
- A validation token is created by encrypting a fixed phrase with the password
- The validation token and TTL are stored in server memory
- The new room is broadcast to all connected clients

---

### In-Memory Store

- Rooms are stored in server memory using JavaScript objects
- Each room contains a TTL value and an encrypted validation token
- TTL is decreased every second on the server
- When TTL reaches zero, the room is deleted and all users are removed
- Restarting the server clears all rooms automatically

---

### Secure Room Join

- User attempts to join a room
- User is prompted to enter the room password
- Client attempts to decrypt the room’s validation token
- If decryption fails, access is denied
- If decryption succeeds, the user is allowed to join
- Passwords are never sent to or stored on the server

---

### End-to-End Encrypted Messaging

- Messages are encrypted in the browser before sending
- Encrypted messages are sent to the server via Socket.IO
- The server only relays encrypted data
- Messages are decrypted in the receiver’s browser
- The server never has access to plaintext messages

---

## View Engine

- Handlebars is used only to render the initial HTML page
- All dynamic behavior is handled on the client side
- Real-time updates are managed using Socket.IO

---

## How to Run Locally

1. Clone the repository
git clone <your-repo-url>


2. Install dependencies
npm install


3. Start the server
npm start

4. Open the application in a browser
http://localhost:3000


---

## Limitations

- No persistent storage is used
- Messages are lost on page refresh
- Encryption is demo-level and not production-grade
- No secure key exchange protocol is implemented

---

## Conclusion

This project demonstrates real-time communication using Socket.IO, proper use of
in-memory data stores, automatic resource cleanup using TTL, and basic end-to-end
encryption implemented entirely on the client side.