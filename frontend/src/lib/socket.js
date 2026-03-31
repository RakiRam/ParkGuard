// Socket.IO client - connects to backend for real-time notifications
// When the real backend is available, this will auto-connect

let socket = null;

export const connectSocket = (userId) => {
  // Socket.IO is mocked in development - real backend will provide WebSocket
  console.log('[Socket] Ready to connect for user:', userId);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const onNotification = (callback) => {
  if (socket) {
    socket.on('notification', callback);
  }
};

export default { connectSocket, disconnectSocket, onNotification };
