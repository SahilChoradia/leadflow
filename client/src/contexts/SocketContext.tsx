import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/Toast';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const { info, success, warning } = useToast();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const hadConnectionRef = useRef(false);
  const disconnectToastIdRef = useRef<boolean>(false);

  useEffect(() => {
    // Only connect if user is authenticated with a token
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_WS_URL || '/';

    const s: Socket = io(socketUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    s.on('connect', () => {
      console.info('[socket] Connected to server with ID:', s.id);
      setIsConnected(true);
      setIsReconnecting(false);

      if (user.brokerageId) {
        s.emit('join:brokerage', user.brokerageId);
      }

      // If reconnected after a dropped connection, resync all tenant state immediately!
      if (hadConnectionRef.current) {
        console.info('[socket] Reconnected — resyncing client state...');
        success('Connection restored — data resynced');
        queryClient.invalidateQueries();
      }
      hadConnectionRef.current = true;
      disconnectToastIdRef.current = false;
    });

    s.on('disconnect', (reason) => {
      console.warn('[socket] Disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket explicitly (e.g. auth invalid)
        s.connect();
      } else {
        setIsReconnecting(true);
        if (!disconnectToastIdRef.current) {
          warning('Real-time connection lost. Reconnecting...');
          disconnectToastIdRef.current = true;
        }
      }
    });

    s.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message);
      setIsConnected(false);
      setIsReconnecting(true);
    });

    s.on('metrics:updated', (updatedMetrics) => {
      queryClient.setQueryData(['dashboard-metrics'], updatedMetrics);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, user?.id, user?.brokerageId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
