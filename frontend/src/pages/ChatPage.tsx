/**
 * @file ChatPage.jsx
 * @description Page component for real-time messaging between employees and within teams.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User, Check, CheckCheck, MessageSquare, RefreshCw } from 'lucide-react';
import { chatAPI, employeesAPI, getProfileImageUrl } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import type { ChatMessage, Conversation, Team } from '../types';

/**
 * ChatPage Component
 * 
 * Manages direct and team chats using WebSockets. Handles sending, receiving,
 * and reading messages alongside unread counts and contact search.
 * 
 * @returns {React.ReactElement} The chat UI.
 */
const ChatPage = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const { connected, ready, subscribe } = useWebSocket();
  
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [chatType, setChatType] = useState('DIRECT');
  const [messageText, setMessageText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  
  // Unread counts per contact
  const [unreadCounts, setUnreadCounts] = useState<Record<string, any>>({});
  
  const [showChatArea, setShowChatArea] = useState<boolean>(false);
  const [messagesAnimated, setMessagesAnimated] = useState<boolean>(false);
  
  const messagesEndRef = useRef<any>(null);
  const lastMessageIdRef = useRef<any>(null);
  const lastSentMessageRef = useRef<any>(null);
  const inputRef = useRef<any>(null);

  // Initial Contacts Fetch
  useEffect(() => {
    if (!ready) return;
    fetchContactsAndTeams();
    fetchUnreadCounts();
  }, [ready]);

  // Initial Messages Fetch
  useEffect(() => {
    if (!ready || (!selectedReceiver && !selectedTeam)) return;
    fetchMessages();
  }, [ready, selectedReceiver?.id, selectedTeam?.teamId, chatType]);

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  //Handle Profile Update to refresh EVERYTHING (Contacts & Chat)
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      try {
        const empProfile = await employeesAPI.getByUserId(user.id);
        setUserProfileImage(empProfile.profileImageUrl);
      } catch (error: any) {
        console.log('No employee profile or image');
      }
    };
    
    fetchUserProfile();
    
    const handleProfileUpdate = () => {
      // 1. Refresh own image
      fetchUserProfile();
      // 2. Refresh contacts list (sidebar)
      fetchContactsAndTeams();
      // 3. Refresh active chat messages if open
      if (selectedReceiver || selectedTeam) {
        fetchMessages();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [user?.id, selectedReceiver, selectedTeam]); // Added dependencies so it knows if chat is open

  /**
   * Fetches unread message counts for all contacts.
   * 
   * @async
   * @function fetchUnreadCounts
   * @returns {Promise<void>}
   */
  const fetchUnreadCounts = async () => {
    try {
      const counts = await chatAPI.getUnreadCountPerContact();
      setUnreadCounts(counts);
    } catch (error: any) {
      console.error('Error fetching unread counts:', error);
    }
  };

  // WebSocket Subscriptions with Unread Count Updates
  useEffect(() => {
    if (!ready) return;

    const unsubs = [
      subscribe(EVENT_TYPES.NEW_MESSAGE, (message) => {
        const isForCurrentChat = 
          (chatType === 'DIRECT' && selectedReceiver && 
            (String(message.senderId) === String(selectedReceiver.id) || 
             String(message.receiverId) === String(selectedReceiver.id) ||
             String(message.senderId) === String(user.id))) ||
          (chatType === 'TEAM' && selectedTeam && 
            String(message.teamId) === String(selectedTeam.teamId));
        
        if (isForCurrentChat) {
          setMessages(prev => {
            const exists = prev.some(m => String(m.id) === String(message.id));
            if (exists) {
              return prev;
            }
            
            return [...prev, message];
          });
          
          // Mark as read if received (not sent by current user)
          if (String(message.senderId) !== String(user.id) && message.id) {
            setTimeout(() => {
              chatAPI.markAsRead(message.id).catch(console.error);
            }, 500);
          }
        } else {
          // Update unread count for this contact
          if (String(message.senderId) !== String(user.id) && chatType === 'DIRECT') {
            setUnreadCounts(prev => ({
              ...prev,
              [message.senderId]: (prev[message.senderId] || 0) + 1
            }));
          }
        }
      }),
      
      subscribe(EVENT_TYPES.MESSAGE_READ, (data: any) => {
        if (data.messageId) {
          setMessages(prev => prev.map(msg => 
            String(msg.id) === String(data.messageId) 
              ? { ...msg, isRead: true, readAt: data.readAt } 
              : msg
          ));
        }
      }),
      
      subscribe(EVENT_TYPES.PROFILE_UPDATED, () => {
        fetchContactsAndTeams();
        if (selectedReceiver || selectedTeam) {
            fetchMessages();
        }
      })
    ];
    
    return () => unsubs.forEach(fn => fn());
  }, [ready, subscribe, selectedReceiver, selectedTeam, chatType, user?.id]);

  /**
   * Fetches the list of available contacts and teams for the user.
   * 
   * @async
   * @function fetchContactsAndTeams
   * @returns {Promise<void>}
   */
  const fetchContactsAndTeams = async () => {
    try {
      const [contactsData, teamsData] = await Promise.all([
        chatAPI.getAvailableContacts(),
        chatAPI.getUserTeamChats()
      ]);
      setContacts(contactsData);
      setTeams(teamsData);
    } catch (error: any) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches message history for the currently selected recipient (user or team)
   * and marks unread ones as read.
   * 
   * @async
   * @function fetchMessages
   * @returns {Promise<void>}
   */
  const fetchMessages = async () => {
    try {
      let data = [];
      
      if (chatType === 'DIRECT' && selectedReceiver?.id) {
        data = await chatAPI.getDirectMessages(selectedReceiver.id);
      } else if (chatType === 'TEAM' && selectedTeam?.teamId) {
        data = await chatAPI.getTeamMessages(selectedTeam.teamId);
      }
      
      const sorted = data.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      setMessages(sorted);
      
      const unread = sorted.filter(msg => 
        !msg.isRead && 
        String(msg.receiverId) === String(user.id) &&
        msg.id !== lastMessageIdRef.current
      );
      
      if (unread.length > 0) {
        setTimeout(() => {
          unread.forEach(msg => {
            chatAPI.markAsRead(msg.id).catch(console.error);
          });
        }, 500);
      }
    } catch (error: any) {
      setMessages([]);
    }
  };

  /**
   * Handles sending a text message to the selected direct user or team.
   * 
   * @async
   * @function handleSendMessage
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    const canSend = (chatType === 'DIRECT' && selectedReceiver) || 
                    (chatType === 'TEAM' && selectedTeam);
    
    if (!messageText.trim() || !canSend || sendingMessage) return;

    const tempMessage = messageText.trim();
    
    setMessageText('');
    setSendingMessage(true);

    const messageData = {
      message: tempMessage,
      messageType: 'TEXT',
      ...(chatType === 'DIRECT'
        ? { receiverId: selectedReceiver.id }
        : { teamId: selectedTeam.teamId }),
    };

    try {
      const sentMessage = await chatAPI.sendMessage(messageData);
      lastSentMessageRef.current = sentMessage.id;
    } catch (error: any) {
      setMessageText(tempMessage);
      console.error('Error sending message: ' + error.message);
     } finally {
      setSendingMessage(false);
       setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 1000); 
   }
  };

  /**
   * Handles selecting a direct contact to chat with.
   * Clears their unread count and prepares the chat UI.
   * 
   * @function handleUserSelect
   * @param {Object} u - The selected user.
   */
  const handleUserSelect = (u) => {
    if (selectedReceiver?.id === u.id) return;
    
    setShowChatArea(false);
    setMessagesAnimated(false);
    
    setTimeout(() => {
      setSelectedReceiver(u);
      setSelectedTeam(null);
      setChatType('DIRECT');
      setMessages([]);
      lastMessageIdRef.current = null;
      lastSentMessageRef.current = null;
      
      // Clear unread count for this contact
      setUnreadCounts(prev => ({
        ...prev,
        [u.id]: 0
      }));
      
      setShowChatArea(true);
      setTimeout(() => setMessagesAnimated(true), 100);
    }, 200);
  };

  /**
   * Handles selecting a team to chat with.
   * Prepares the team chat UI.
   * 
   * @function handleTeamSelect
   * @param {Object} t - The selected team.
   */
  const handleTeamSelect = (t) => {
    if (selectedTeam?.teamId === t.teamId) return;
    
    setShowChatArea(false);
    setMessagesAnimated(false);
    
    setTimeout(() => {
      setSelectedTeam(t);
      setSelectedReceiver(null);
      setChatType('TEAM');
      setMessages([]);
      lastMessageIdRef.current = null;
      lastSentMessageRef.current = null;
      
      setShowChatArea(true);
      setTimeout(() => setMessagesAnimated(true), 100);
    }, 200);
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const currentRecipient = chatType === 'DIRECT' ? selectedReceiver : selectedTeam;
  const canSend = (chatType === 'DIRECT' && selectedReceiver) || 
                  (chatType === 'TEAM' && selectedTeam);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center animate-fadeIn">
        <h1 className={`text-3xl font-bold flex items-center gap-3 ${
          darkMode ? 'text-gray-100' : 'text-gray-900'
        }`}>
          Chat
          <span className={`flex items-center gap-1 text-sm ${ready ? 'text-green-600' : 'text-yellow-500'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${ready ? 'bg-green-600' : 'bg-yellow-500'}`} /> 
            {ready ? 'Real-time' : 'Connecting...'}
          </span>
        </h1>
        <button
          onClick={() => {
            fetchContactsAndTeams();
            fetchMessages();
            fetchUnreadCounts();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            darkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Now
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden">
        {/* Sidebar */}
        <div className={`rounded-lg shadow p-4 lg:col-span-1 flex flex-col overflow-hidden animate-slideIn ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          <div className="flex gap-2 mb-4 flex-shrink-0">
            <button
              onClick={() => setChatType('DIRECT')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition text-sm ${
                chatType === 'DIRECT'
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <User className="w-4 h-4 inline mr-1" /> Direct
            </button>
            <button
              onClick={() => setChatType('TEAM')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition text-sm ${
                chatType === 'TEAM'
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" /> Teams
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {chatType === 'DIRECT' ? (
              contacts.length > 0 ? (
                contacts.map((contact, idx) => {
                  const contactImage = contact.profileImageUrl 
                    ? getProfileImageUrl(contact.profileImageUrl)
                    : null;
                  
                  const unreadCount = unreadCounts[contact.id] || 0;
                    
                  return (
                    <button
                      key={contact.id}
                      onClick={() => handleUserSelect(contact)}
                      className={`w-full text-left p-3 rounded-lg transition slide-up relative ${
                        selectedReceiver?.id === contact.id 
                          ? (darkMode ? 'bg-indigo-700 text-white' : 'bg-indigo-50 text-indigo-900 border-2 border-indigo-600')
                          : (darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-50 text-gray-900 hover:bg-gray-100')
                      }`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        {contactImage ? (
                          <img 
                            key={contactImage} 
                            src={contactImage}
                            alt={contact.username}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              ((e.target as HTMLElement).nextSibling as HTMLElement).style.display = 'flex';
                            }}
                          />
                        ) : null}
                        
                        {/* Fallback Icon for Sidebar */}
                        <div 
                          className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold"
                          style={{ display: contactImage ? 'none' : 'flex' }}
                        >
                          <User className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {contact.username}
                          </p>
                          <p className={`text-xs truncate ${
                            selectedReceiver?.id === contact.id
                              ? (darkMode ? 'text-indigo-200' : 'text-indigo-700')
                              : (darkMode ? 'text-gray-400' : 'text-gray-600')
                          }`}>
                            {contact.role}
                          </p>
                        </div>
                        
                        {unreadCount > 0 && (
                          <span className="flex-shrink-0 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className={`text-center py-8 ${
                  darkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  No contacts
                </div>
              )
            ) : teams.length > 0 ? (
              teams.map((t, idx) => (
                <button
                  key={t.teamId}
                  onClick={() => handleTeamSelect(t)}
                  className={`w-full text-left p-3 rounded-lg transition slide-up ${
                    selectedTeam?.teamId === t.teamId 
                      ? (darkMode ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-900 border-2 border-purple-600')
                      : (darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-50 text-gray-900 hover:bg-gray-100')
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {t.teamName}
                      </p>
                      <p className={`text-xs ${
                        selectedTeam?.teamId === t.teamId
                          ? (darkMode ? 'text-purple-200' : 'text-purple-700')
                          : (darkMode ? 'text-gray-400' : 'text-gray-600')
                      }`}>
                        {t.memberCount} members
                      </p>
                    </div>
                  </div>
                </button>
              ))

            ) : (
              <div className={`text-center py-8 ${
                darkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                No teams
              </div>
            )
            }
          </div>
        </div>

        {/* Chat Area */}
        <div className={`lg:col-span-3 rounded-lg shadow flex flex-col overflow-hidden transition-opacity duration-300 ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        } ${showChatArea ? 'opacity-100' : 'opacity-0'}`}>
          {currentRecipient ? (
            <>
              {/* Header */}
              <div className={`p-4 border-b flex items-center gap-3 flex-shrink-0 scale-in ${
                darkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                {(() => {
                  const getRecipientImage = () => {
                    if (chatType === 'DIRECT' && selectedReceiver) {
                      const latestContact = contacts.find(c => c.id === selectedReceiver.id);
                      return latestContact?.profileImageUrl || selectedReceiver.profileImageUrl;
                    }
                    return null;
                  };
                  
                  const recipientImage = getRecipientImage();
                  const imageUrl = recipientImage ? getProfileImageUrl(recipientImage) : null;
                  
                  return (
                    <>
                      {imageUrl ? (
                        <img
                          key={imageUrl}
                          src={imageUrl}
                          alt={chatType === 'DIRECT' ? currentRecipient.username : currentRecipient.teamName}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            ((e.target as HTMLElement).nextSibling as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      
                      {/* Fallback Icon for Header */}
                      <div
                        className={`w-10 h-10 rounded-full ${
                          chatType === 'DIRECT'
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                            : 'bg-gradient-to-br from-green-500 to-teal-600'
                        } flex items-center justify-center text-white font-bold`}
                        style={{ display: imageUrl ? 'none' : 'flex' }}
                      >
                        {chatType === 'DIRECT' 
                          ? <User className="w-5 h-5" />
                          : <Users className="w-5 h-5" />}
                      </div>
                      
                      <div>
                        <h3 className={`font-semibold ${
                          darkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {chatType === 'DIRECT' ? currentRecipient.username : currentRecipient.teamName}
                        </h3>
                        <p className={`text-xs ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {chatType === 'DIRECT'
                            ? currentRecipient.role
                            : `Team Chat • ${currentRecipient.memberCount || 0} members`}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length > 0 ? (
                  <>
                    {messages.map((msg, idx) => {
                      const isSent = String(msg.senderId) === String(user.id);
                      
                      const senderImageUrl = msg.senderProfileImageUrl 
                        ? getProfileImageUrl(msg.senderProfileImageUrl)
                        : null;

                      const currentUserImage = userProfileImage 
                        ? getProfileImageUrl(userProfileImage)
                        : null;
                      
                      return (
                        <div
                          key={msg.id}
                          style={{ 
                            animationDelay: messagesAnimated ? `${idx * 30}ms` : '0ms',
                            animationDuration: '260ms'
                          }}
                          className={`flex gap-3 ${isSent ? 'justify-end slide-in-right' : 'justify-start slide-in-left'}`}
                        >
                          {!isSent && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative overflow-hidden">
                              {/* Icon Background (Visible if image fails/missing) */}
                              <User className="w-4 h-4 absolute" />
                              
                              {senderImageUrl && (
                                <img 
                                  src={senderImageUrl}
                                  alt={msg.senderName}
                                  className="w-full h-full object-cover relative z-10"
                                  onError={(e) => (e.target as HTMLElement).style.display = 'none'}
                                />
                              )}
                            </div>
                          )}
                                                                
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              isSent
                                ? 'bg-indigo-600 text-white'
                                : darkMode
                                  ? 'bg-gray-700 text-gray-100'
                                  : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {chatType === 'TEAM' && !isSent && (
                              <p className="text-xs font-medium mb-1 opacity-75">
                                {msg.senderName || 'Unknown'}
                              </p>
                            )}
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <p className="text-xs opacity-75">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                              {isSent && (
                                msg.isRead ? (
                                  <CheckCheck className="w-3 h-3 text-blue-300" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )
                              )}
                            </div>
                          </div>
                          
                          {isSent && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative overflow-hidden">
                              {/* Icon Background (Visible if image fails/missing) */}
                              <User className="w-4 h-4 absolute" />
                              
                              {currentUserImage && (
                                <img 
                                  src={currentUserImage}
                                  alt={user?.username}
                                  className="w-full h-full object-cover relative z-10"
                                  onError={(e) => (e.target as HTMLElement).style.display = 'none'}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className={`flex flex-col items-center justify-center h-full fade-in ${
                    darkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    <MessageSquare className={`w-16 h-16 mb-4 ${
                      darkMode ? 'text-gray-600' : 'text-gray-300'
                    }`} />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className={`border-t p-4 flex-shrink-0 ${
                darkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={messageText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageText(e.target.value)}
                    placeholder={!canSend ? 'Select a recipient...' : 'Type a message...'}
                    disabled={!canSend || sendingMessage}
                    className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 disabled:bg-gray-900'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 disabled:bg-gray-100'
                    }`}
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!canSend || !messageText.trim() || sendingMessage}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {sendingMessage ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className={`flex flex-col items-center justify-center h-full fade-in ${
              darkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>
              <MessageSquare className={`w-16 h-16 mb-4 ${
                darkMode ? 'text-gray-600' : 'text-gray-300'
              }`} />
              <p>Select a {chatType.toLowerCase()} to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;