import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
        if (this.userId) {
          this.joinUserRoom(this.userId);
        }
      });
      
      this.socket.on('room-joined', (data) => {
        console.log(data.message);
      });
    }
    return this.socket;
  }

  joinUserRoom(userId: string) {
    this.userId = userId;
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-user-room', userId);
    } else {
      this.connect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket || this.connect();
  }
}

export const socketService = new SocketService();
