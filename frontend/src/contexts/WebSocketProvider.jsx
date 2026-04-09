// src/contexts/WebSocketProvider.jsx
/**
 * @fileoverview WebSocket context provider using STOMP over SockJS.
 * Manages a persistent STOMP connection, handles per-user topic subscriptions,
 * and dispatches real-time events to registered component listeners.
 * Provides a custom hook, useWebSocket, for consuming the context.
 */
import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "./AuthContext";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

/**
 * Enumeration of all supported real-time event type identifiers.
 * Components register listeners against these keys via the subscribe() function.
 *
 * @constant {Object.<string, string>} EVENT_TYPES
 */
export const EVENT_TYPES = {
  NEW_MESSAGE: 'NEW_MESSAGE',
  MESSAGE_READ: 'MESSAGE_READ',
  NEW_NOTIFICATION: 'NEW_NOTIFICATION',
  NOTIFICATION_READ: 'NOTIFICATION_READ',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_ACCEPTED: 'ASSIGNMENT_ACCEPTED',
  USER_PROMOTED: 'USER_PROMOTED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  CONNECTION_CHANGED: 'CONNECTION_CHANGED',
  TASK_COMMENT_ADDED: 'TASK_COMMENT_ADDED',
  ASSIGNMENT_UPDATED: 'ASSIGNMENT_UPDATED'
};

const WebSocketContext = createContext({
  connected: false,
  ready: false, //Indicates WebSocket is connected AND subscribed
  subscribe: () => () => {},
  send: () => {},
  reconnect: () => {}
});

export const WebSocketProvider = ({ children }) => {
  const { user, token, authReady } = useAuth();
  
  const stompClientRef = useRef(null);
  const subscriptionsRef = useRef(new Map());
  const listenersRef = useRef(new Map());
  const handlerIdCounter = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);
  
  const [connectionState, setConnectionState] = useState({ 
    connected: false,
    ready: false
  });
  
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

/**
 * Dispatches a real-time event to all registered listeners for a given event type.
 *
 * @param {string} eventType - One of the EVENT_TYPES keys.
 * @param {*} data - The event payload to pass to each handler.
 */
  const broadcastEvent = useCallback((eventType, data) => {
    const handlers = listenersRef.current.get(eventType);
    if (!handlers || handlers.size === 0) return;

    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`Handler error for ${eventType}:`, err);
      }
    });
  }, []);

/**
 * Registers a handler function for a specific event type.
 * Returns an unsubscribe function that removes the handler when called.
 *
 * @param {string} eventType - The event type to listen for.
 * @param {Function} handler - The callback function that receives the event payload.
 * @returns {Function} An unsubscribe function to deregister the handler.
 */
  const subscribe = useCallback((eventType, handler) => {
    const handlerId = ++handlerIdCounter.current;
    
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Map());
    }
    
    const handlers = listenersRef.current.get(eventType);
    handlers.set(handlerId, handler);
        
    return () => {
      if (listenersRef.current.has(eventType)) {
        const handlers = listenersRef.current.get(eventType);
        if (handlers.delete(handlerId)) {
          console.log(`Unsubscribed from ${eventType} (handler #${handlerId})`);
        }
      }
    };
  }, []);

/**
 * Publishes a message to a STOMP destination topic.
 * Does nothing if the STOMP connection is not currently active.
 *
 * @param {string} destination - The STOMP destination topic (e.g., '/app/chat.send').
 * @param {*} body - The message payload, which will be serialized to JSON.
 */
  const send = useCallback((destination, body) => {
    if (stompClientRef.current?.connected) {
      stompClientRef.current.publish({
        destination,
        body: JSON.stringify(body)
      });
    }
  }, []);

  const updateConnectionState = useCallback((connected, ready = false) => {
    setConnectionState({ connected, ready });
    broadcastEvent(EVENT_TYPES.CONNECTION_CHANGED, { connected, ready });
  }, [broadcastEvent]);

/**
 * Initializes and activates a new STOMP client connection.
 * Subscribes to all user-specific and topic channels on successful connection.
 * Schedules an automatic reconnect on error or disconnect events.
 */
  const connectWebSocket = useCallback(() => {
    if (!authReady || !token || !user) {
      return;
    }

    if (stompClientRef.current?.connected) {
      return;
    }

    const WS_BASE_URL = import.meta.env.VITE_API_URL;
    const socket = new SockJS(`${WS_BASE_URL}/ws`);
    
    const stompClient = new Client({
      webSocketFactory: () => socket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      
      onConnect: () => {
        if (!mountedRef.current) return;
        
        updateConnectionState(true, false); // Connected but not ready yet
        reconnectAttemptsRef.current = 0;

        const subs = subscriptionsRef.current;

        //PROFILE UPDATES
        if (!subs.has('profile-update')) {
          subs.set('profile-update', stompClient.subscribe(`/user/queue/profile-update`, (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);
              broadcastEvent(EVENT_TYPES.PROFILE_UPDATED, data);
            } catch (error) {
              console.error('Profile update error:', error);
            }
          }));
        }
        
        //NOTIFICATIONS
        if (!subs.has('notifications')) {
          subs.set('notifications', stompClient.subscribe(`/user/queue/notifications`, (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);              
              if (data.type === 'ROLE_PROMOTION') {
                broadcastEvent(EVENT_TYPES.USER_PROMOTED, data);
              }
              broadcastEvent(EVENT_TYPES.NEW_NOTIFICATION, data);
            } catch (error) {
              console.error('Notification parse error:', error);
            }
          }));
        }

        if (!subs.has('notification-update')) {
          subs.set('notification-update', stompClient.subscribe(`/user/queue/notification-update`, (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);
              broadcastEvent(EVENT_TYPES.NOTIFICATION_READ, data);
            } catch (error) {
              console.error('Notification update error:', error);
            }
          }));
        }

        //CHAT
        if (!subs.has('messages')) {
          subs.set('messages', stompClient.subscribe(`/user/queue/messages`, (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);
              
              broadcastEvent(EVENT_TYPES.NEW_MESSAGE, data);
              
            } catch (error) {
              console.error('Chat message error:', error);
            }
          }));
          
        }

        if (!subs.has('chat-update')) {
          subs.set('chat-update', stompClient.subscribe(`/user/queue/chat-update`, (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);
              broadcastEvent(EVENT_TYPES.MESSAGE_READ, data);
            } catch (error) {
              console.error('Chat update error:', error);
            }
          }));
        }

        //TASKS
        if (!subs.has('task-updates')) {
          subs.set('task-updates', stompClient.subscribe(`/user/queue/task-updates`, (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);
              
              if (data.action === 'task_created' || data.action === 'task_request') {
                broadcastEvent(EVENT_TYPES.TASK_CREATED, data.task);
              } else if (data.action === 'task_status_updated') {
                broadcastEvent(EVENT_TYPES.TASK_STATUS_CHANGED, data.task);
              } else if (data.action === 'task_approved') {
                broadcastEvent(EVENT_TYPES.TASK_APPROVED, data.task);
              } else if (data.action === 'task_rejected') {
                broadcastEvent(EVENT_TYPES.TASK_REJECTED, data.task);
              }
            } catch (error) {
              console.error('Task update error:', error);
            }
          }));
        }

        //ASSIGNMENTS
        if (!subs.has('assignment-updates')) {
          subs.set('assignment-updates', stompClient.subscribe(`/user/queue/assignment-updates`, (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);
              
              if (data.action === 'assignment_created') {
                broadcastEvent(EVENT_TYPES.ASSIGNMENT_CREATED, data.assignment);
              } else if (data.action === 'assignment_accepted') {
                broadcastEvent(EVENT_TYPES.ASSIGNMENT_ACCEPTED, data.assignment);
              }
            } catch (error) {
              console.error('Assignment error:', error);
            }
          }));
        }
          
        // GLOBAL PROFILE UPDATES
        if (!subs.has('global-profile-updates')) {
          subs.set('global-profile-updates', stompClient.subscribe('/topic/profile-updates', (msg) => {
            if (!mountedRef.current) return;
            try {
              const data = JSON.parse(msg.body);
              broadcastEvent(EVENT_TYPES.PROFILE_UPDATED, data);
            } catch (error) {
              console.error('Global profile update error:', error);
            }
          }));
        }
        
        //NOW mark as ready (subscriptions complete)
        updateConnectionState(true, true);
      },
      
      onStompError: (frame) => {
        updateConnectionState(false, false);
        attemptReconnect();
      },
      
      onDisconnect: () => {
        if (mountedRef.current) {
          updateConnectionState(false, false);
          attemptReconnect();
        }
      },

      onWebSocketClose: () => {
        updateConnectionState(false, false);
        attemptReconnect();
      }
    });

    stompClient.activate();
    stompClientRef.current = stompClient;
  }, [token, user, authReady, broadcastEvent, updateConnectionState]);

/**
 * Schedules an exponential-backoff reconnect attempt after a disconnect.
 * Stops retrying after MAX_RECONNECT_ATTEMPTS successive failures.
 */
  const attemptReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = RECONNECT_DELAY * reconnectAttemptsRef.current;
        
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        connectWebSocket();
      }
    }, delay);
  }, [connectWebSocket]);

/**
 * Forcibly deactivates the current STOMP connection and triggers a fresh connect.
 * Used when the user explicitly requests a reconnect (e.g., after a network error).
 */
  const reconnect = useCallback(() => {
    if (stompClientRef.current?.connected) {
      stompClientRef.current.deactivate();
    }
    reconnectAttemptsRef.current = 0;
    setConnectionState({ connected: false, ready: false });
    connectWebSocket();
  }, [connectWebSocket]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (stompClientRef.current?.connected) {
        subscriptionsRef.current.forEach((sub, key) => {
          sub.unsubscribe();
        });
        subscriptionsRef.current.clear();
        stompClientRef.current.deactivate();
      }
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!user || !token) {
      if (stompClientRef.current?.connected) {
        subscriptionsRef.current.forEach(sub => sub.unsubscribe());
        subscriptionsRef.current.clear();
        stompClientRef.current.deactivate();
        updateConnectionState(false, false);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (mountedRef.current && !stompClientRef.current?.connected) {
        connectWebSocket();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [authReady, user, token, connectWebSocket, updateConnectionState]);

  return (
    <WebSocketContext.Provider value={{ 
      connected: connectionState.connected,
      ready: connectionState.ready,
      subscribe, 
      send,
      reconnect
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Custom hook for consuming the WebSocketContext.
 * Must be called within a component that is a descendant of WebSocketProvider.
 *
 * @returns {{ connected: boolean, ready: boolean, subscribe: Function, send: Function, reconnect: Function }}
 * @throws {Error} If called outside of a WebSocketProvider.
 */
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};