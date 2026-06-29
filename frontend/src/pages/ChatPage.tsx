/**
 * @file ChatPage.jsx
 * @description Page component for real-time messaging between employees and within teams.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User, Check, CheckCheck, MessageSquare, RefreshCw, Search, X, Edit2, Trash2, LogOut } from 'lucide-react';
import { chatAPI, employeesAPI, usersAPI, teamsAPI, getProfileImageUrl, getAuthHeaders } from '../utils/api';
import { parseUTCDate } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import EmployeeProfileModal from '../components/EmployeeProfileModal';

const getStatusColor = (status?: string) => {
  switch (status?.toUpperCase()) {
    case 'ONLINE': return 'bg-green-500';
    case 'AWAY': return 'bg-yellow-500';
    case 'BUSY':
    case 'DO_NOT_DISTURB': return 'bg-red-500';
    case 'OFFLINE':
    default: return 'bg-gray-400';
  }
};

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
  const confirm = useConfirm();
  const { showToast } = useToast();
  
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [userStatuses, setUserStatuses] = useState<Record<string, string>>({});
  const [teams, setTeams] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [chatType, setChatType] = useState('DIRECT');
  const [messageText, setMessageText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{mouseX: number, mouseY: number, message: any} | null>(null);
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{mouseX: number, mouseY: number, type: 'DIRECT' | 'GROUP', data: any} | null>(null);
  
  // Unread counts per contact
  const [unreadCounts, setUnreadCounts] = useState<Record<string, any>>({});
  
  const [showChatArea, setShowChatArea] = useState<boolean>(false);
  const [messagesAnimated, setMessagesAnimated] = useState<boolean>(false);
  // Search state for filtering contacts / teams in the sidebar
  const [contactSearch, setContactSearch] = useState<string>('');
  
  // Modal states
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [isRenamingGroup, setIsRenamingGroup] = useState<boolean>(false);
  const [showGroupMembersDropdown, setShowGroupMembersDropdown] = useState<boolean>(false);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [renameTargetGroup, setRenameTargetGroup] = useState<any>(null);
  const [sidebarRenameName, setSidebarRenameName] = useState<string>('');
  const [hiddenContactIds, setHiddenContactIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('chat_hidden_contacts') || '[]'));
  
  const messagesEndRef = useRef<any>(null);
  const lastMessageIdRef = useRef<any>(null);
  const lastSentMessageRef = useRef<any>(null);
  const inputRef = useRef<any>(null);

  // Initial Contacts Fetch
  useEffect(() => {
    fetchContactsAndTeams();
    fetchUnreadCounts();
  }, []);

  // Initial Messages Fetch
  useEffect(() => {
    if (!selectedReceiver && !selectedTeam && !selectedGroup) return;
    fetchMessages();
  }, [selectedReceiver?.id, selectedTeam?.teamId, selectedGroup?.id, chatType]);

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
      if (selectedReceiver || selectedTeam || selectedGroup) {
        fetchMessages();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [user?.id, selectedReceiver, selectedTeam, selectedGroup]); // Added dependencies so it knows if chat is open

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
      // Ignored in production
    }
  };

  // WebSocket Subscriptions with Unread Count Updates
  useEffect(() => {
    if (!ready) return;

    const unsubs = [
      subscribe(EVENT_TYPES.NEW_MESSAGE, (message: any) => {
        if (message.senderId) {
          setHiddenContactIds(prev => {
            if (prev.includes(message.senderId)) {
              const updated = prev.filter(id => id !== message.senderId);
              localStorage.setItem('chat_hidden_contacts', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });
        }
        const isForCurrentChat = 
          (chatType === 'DIRECT' && selectedReceiver && 
            (String(message.senderId) === String(selectedReceiver.id) || 
             String(message.receiverId) === String(selectedReceiver.id) ||
             String(message.senderId) === String(user.id))) ||
          (chatType === 'TEAM' && selectedTeam && 
            String(message.teamId) === String(selectedTeam.teamId)) ||
          (chatType === 'GROUP' && selectedGroup &&
            String(message.chatRoomId) === String(selectedGroup.id));
        
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
              chatAPI.markAsRead(message.id).catch(() => {});
            }, 500);
          }
        } else {
          // Update unread count for this contact
          if (String(message.senderId) !== String(user.id) && chatType === 'DIRECT') {
            setUnreadCounts(prev => ({
              ...prev,
              [message.senderId]: (prev[message.senderId] || 0) + 1
            }));
          } else if (String(message.senderId) !== String(user.id) && chatType === 'GROUP' && message.chatRoomId) {
            setUnreadCounts(prev => ({
              ...prev,
              [message.chatRoomId]: (prev[message.chatRoomId] || 0) + 1
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

      subscribe(EVENT_TYPES.MESSAGE_UPDATED, (updatedMsg: any) => {
        setMessages(prev => prev.map(msg => 
          String(msg.id) === String(updatedMsg.id) ? updatedMsg : msg
        ));
      }),

      subscribe(EVENT_TYPES.MESSAGE_DELETED, (data: any) => {
        if (data.messageId) {
          setMessages(prev => prev.filter(msg => String(msg.id) !== String(data.messageId)));
        }
      }),
      
      subscribe(EVENT_TYPES.PROFILE_UPDATED, () => {
        fetchContactsAndTeams();
        if (selectedReceiver || selectedTeam || selectedGroup) {
            fetchMessages();
        }
      }),
      
      subscribe(EVENT_TYPES.PRESENCE_UPDATED, (data: any) => {
        setContacts(prev => prev.map(c => 
          String(c.id) === String(data.userId) ? { ...c, status: data.status } : c
        ));
        setUserStatuses(prev => ({ ...prev, [data.userId]: data.status }));
        if (selectedReceiver && String(selectedReceiver.id) === String(data.userId)) {
          setSelectedReceiver(prev => prev ? { ...prev, status: data.status } : prev);
        }
      })
    ];
    
    return () => unsubs.forEach(fn => fn());
  }, [ready, subscribe, selectedReceiver, selectedTeam, selectedGroup, chatType, user?.id]);

  // Close context menu on click
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setSidebarContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  /**
   * Fetches the list of available contacts and teams for the user.
   * 
   * @async
   * @function fetchContactsAndTeams
   * @returns {Promise<void>}
   */
  const fetchContactsAndTeams = async () => {
    try {
      const [contactsData, teamsData, groupsData, allUsersData] = await Promise.all([
        chatAPI.getAvailableContacts().catch(() => []),
        chatAPI.getUserTeamChats().catch(() => []),
        fetch('/api/chat/group', { headers: getAuthHeaders() })
          .then(res => res.ok ? res.json() : [])
          .catch(() => []),
        usersAPI.getAll().catch(() => [])
      ]);
      
      setContacts(contactsData || []);
      setTeams(teamsData || []);
      setGroups(groupsData || []);
      
      const statuses: Record<string, string> = {};
      if (allUsersData) {
        allUsersData.forEach((u: any) => {
          statuses[u.id] = u.status || 'OFFLINE';
        });
      }
      setUserStatuses(statuses);
    } catch (error: any) {
      console.error('FETCH DATA ERROR:', error);
      // Ignored in production
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
      } else if (chatType === 'GROUP' && selectedGroup?.id) {
        data = await fetch(`/api/chat/group/${selectedGroup.id}/messages`, { headers: getAuthHeaders() }).then(res => res.json());
      }
      
      const sorted = data.sort((a, b) => 
        parseUTCDate(a.createdAt).getTime() - parseUTCDate(b.createdAt).getTime()
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
            chatAPI.markAsRead(msg.id).catch(() => {});
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
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const canSend = (chatType === 'DIRECT' && selectedReceiver) || 
                    (chatType === 'TEAM' && selectedTeam) ||
                    (chatType === 'GROUP' && selectedGroup);
    
    if (!messageText.trim() || !canSend || sendingMessage) return;

    const tempMessage = messageText.trim();
    
    setMessageText('');
    setSendingMessage(true);

    const messageData = {
      message: tempMessage,
      messageType: 'TEXT',
      ...(chatType === 'DIRECT'
        ? { receiverId: selectedReceiver.id }
        : chatType === 'TEAM' 
          ? { teamId: selectedTeam.teamId }
          : { chatRoomId: selectedGroup.id }),
    };

    try {
      if (editingMessage) {
        const updatedMsg = await chatAPI.editMessage(editingMessage.id, tempMessage);
        setMessages(prev => prev.map(msg => String(msg.id) === String(editingMessage.id) ? updatedMsg : msg));
        setEditingMessage(null);
        setSendingMessage(false);
        return;
      }

      const sentMessage = await chatAPI.sendMessage(messageData);
      lastSentMessageRef.current = sentMessage.id;
      // Optimistically append the sent message immediately so the sender
      // sees it without waiting for the WebSocket echo. The WS handler
      // deduplicates by ID so no double-render occurs.
      if (sentMessage && sentMessage.id) {
        setMessages(prev => {
          const exists = prev.some(m => String(m.id) === String(sentMessage.id));
          if (exists) return prev;
          return [...prev, sentMessage];
        });
      }
    } catch (error: any) {
      setMessageText(tempMessage);
      // Ignored in production
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
  // Also clear the search when switching tab so it doesn't bleed across
  const handleUserSelect = (u) => {
    if (selectedReceiver?.id === u.id) return;
    setContactSearch('');
    
    setHiddenContactIds(prev => {
      const updated = prev.filter(id => id !== u.id);
      localStorage.setItem('chat_hidden_contacts', JSON.stringify(updated));
      return updated;
    });
    
    setShowChatArea(false);
    setMessagesAnimated(false);
    
    setTimeout(() => {
      setSelectedReceiver(u);
      setSelectedTeam(null);
      setSelectedGroup(null);
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
    setContactSearch('');
    
    setShowChatArea(false);
    setMessagesAnimated(false);
    
    setTimeout(async () => {
      try {
        const fullTeam = await teamsAPI.getById(t.teamId || t.id);
        setSelectedTeam({ ...t, members: fullTeam.members || fullTeam.users || [] });
      } catch (e) {
        console.error("Failed to fetch full team details", e);
        setSelectedTeam(t);
      }
      setSelectedReceiver(null);
      setSelectedGroup(null);
      setChatType('TEAM');
      setMessages([]);
      lastMessageIdRef.current = null;
      lastSentMessageRef.current = null;
      
      setShowChatArea(true);
      setTimeout(() => setMessagesAnimated(true), 100);
    }, 200);
  };

  const handleGroupSelect = (g) => {
    if (selectedGroup?.id === g.id) return;
    setContactSearch('');
    setShowGroupMembersDropdown(false);
    
    setShowChatArea(false);
    setMessagesAnimated(false);
    
    setTimeout(() => {
      setSelectedGroup(g);
      setSelectedReceiver(null);
      setSelectedTeam(null);
      setChatType('GROUP');
      setMessages([]);
      lastMessageIdRef.current = null;
      lastSentMessageRef.current = null;
      
      setUnreadCounts(prev => ({
        ...prev,
        [g.id]: 0
      }));
      
      setShowChatArea(true);
      setTimeout(() => setMessagesAnimated(true), 100);
    }, 200);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const { getAuthHeaders } = await import('../utils/api');
      const payload = {
        name: newGroupName,
        memberIds: newGroupMembers
      };
      await fetch('/api/chat/group', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupMembers([]);
      fetchContactsAndTeams();
    } catch (error) {
      console.error(error);
    }
  };

  const handleRenameGroup = async () => {
    if (!renameGroupName.trim() || !selectedGroup) return;
    try {
      const { getAuthHeaders } = await import('../utils/api');
      await fetch(`/api/chat/group/${selectedGroup.id}/rename`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: renameGroupName })
      });
      setIsRenamingGroup(false);
      fetchContactsAndTeams();
      setSelectedGroup({ ...selectedGroup, name: renameGroupName });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSidebarRenameGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sidebarRenameName.trim() || !renameTargetGroup) return;
    try {
      const { getAuthHeaders } = await import('../utils/api');
      const response = await fetch(`/api/chat/group/${renameTargetGroup.id}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ name: sidebarRenameName.trim() })
      });
      if (response.ok) {
        const updated = await response.json();
        setGroups(prev => prev.map(g => g.id === renameTargetGroup.id ? updated : g));
        if (selectedGroup && selectedGroup.id === renameTargetGroup.id) {
          setSelectedGroup(updated);
        }
        showToast('Group renamed successfully!', 'success');
      } else {
        showToast('Failed to rename group', 'error');
      }
    } catch (err) {
      console.error('Rename group error:', err);
      showToast('Failed to rename group', 'error');
    } finally {
      setShowRenameModal(false);
      setRenameTargetGroup(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    const isConfirmed = await confirm({
      title: 'Delete Group',
      message: 'Are you sure you want to permanently delete this group? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger'
    });
    if (!isConfirmed) return;

    try {
      const { getAuthHeaders } = await import('../utils/api');
      await fetch(`/api/chat/group/${selectedGroup.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      setSelectedGroup(null);
      setChatType('DIRECT');
      fetchContactsAndTeams();
      showToast('Group deleted successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to delete group', 'error');
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;

    const isConfirmed = await confirm({
      title: 'Leave Group',
      message: 'Are you sure you want to leave this group?',
      confirmText: 'Leave',
      variant: 'danger'
    });
    if (!isConfirmed) return;

    try {
      const { getAuthHeaders } = await import('../utils/api');
      await fetch(`/api/chat/group/${selectedGroup.id}/leave`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      setSelectedGroup(null);
      setChatType('DIRECT');
      fetchContactsAndTeams();
      showToast('You left the group', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to leave group', 'error');
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const currentRecipient = chatType === 'DIRECT' ? selectedReceiver : (chatType === 'TEAM' ? selectedTeam : selectedGroup);
  const canSend = (chatType === 'DIRECT' && selectedReceiver) || 
                  (chatType === 'TEAM' && selectedTeam) ||
                  (chatType === 'GROUP' && selectedGroup);

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
        <div className={`rounded-lg shadow p-4 lg:col-span-1 flex flex-col overflow-hidden animate-slideIn border ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
        }`}>
          {/* Tab buttons */}
          <div className="flex gap-2 mb-3 flex-shrink-0">
            <button
              onClick={() => { setChatType('DIRECT'); setContactSearch(''); }}
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
              onClick={() => { setChatType('TEAM'); setContactSearch(''); }}
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
            <button
              onClick={() => { setChatType('GROUP'); setContactSearch(''); }}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition text-sm ${
                chatType === 'GROUP'
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" /> Groups
            </button>
          </div>

          {/* Search bar for contacts / teams / groups */}
          <div className={`relative mb-3 flex-shrink-0`}>
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
              darkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              value={contactSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactSearch(e.target.value)}
              placeholder={chatType === 'DIRECT' ? 'Search contacts...' : chatType === 'TEAM' ? 'Search teams...' : 'Search groups...'}
              className={`w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border outline-none transition duration-200 ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 hover:border-gray-400 focus:ring-4 focus:ring-indigo-500/10'
              }`}
            />
            {contactSearch && (
              <button
                onClick={() => setContactSearch('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                  darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {chatType === 'DIRECT' ? (
              (() => {
                const filtered = contacts.filter(c => {
                  const matchesSearch = c.username?.toLowerCase().includes(contactSearch.toLowerCase());
                  if (contactSearch.trim()) {
                    return matchesSearch;
                  }
                  return !hiddenContactIds.includes(c.id) && matchesSearch;
                });
                return filtered.length > 0 ? (
                  filtered.map((contact, idx) => {
                  const contactImage = contact.profileImageUrl 
                    ? getProfileImageUrl(contact.profileImageUrl)
                    : null;
                  
                  const unreadCount = unreadCounts[contact.id] || 0;
                    
                  return (
                    <button
                      key={contact.id}
                      onClick={() => handleUserSelect(contact)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSidebarContextMenu({
                          mouseX: e.clientX,
                          mouseY: e.clientY,
                          type: 'DIRECT',
                          data: contact
                        });
                      }}
                      className={`w-full text-left p-3 rounded-lg transition slide-up border relative ${
                        selectedReceiver?.id === contact.id 
                          ? (darkMode ? 'bg-indigo-700 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-900 border-indigo-600')
                          : (darkMode ? 'bg-gray-700 text-gray-200 border-gray-600/50 hover:bg-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100 hover:border-gray-300')
                      }`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
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
                          
                          {/* Activity Status Indicator */}
                          <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 ${darkMode ? 'border-gray-800' : 'border-white'} rounded-full ${getStatusColor(userStatuses[contact.id] || contact.status)}`}></span>
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
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {contactSearch ? 'No contacts match your search.' : 'No contacts'}
                </div>
              );
              })()
            ) : chatType === 'TEAM' ? (() => {
              const filteredTeams = teams.filter(t =>
                t.teamName?.toLowerCase().includes(contactSearch.toLowerCase())
              );
              return filteredTeams.length > 0 ? (
                filteredTeams.map((t, idx) => (
                <button
                  key={t.teamId}
                  onClick={() => handleTeamSelect(t)}
                  className={`w-full text-left p-3 rounded-lg transition slide-up border ${
                    selectedTeam?.teamId === t.teamId 
                      ? (darkMode ? 'bg-purple-700 text-white border-purple-600' : 'bg-purple-50 text-purple-900 border-purple-600')
                      : (darkMode ? 'bg-gray-700 text-gray-200 border-gray-600/50 hover:bg-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100 hover:border-gray-300')
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
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {contactSearch ? 'No teams match your search.' : 'No teams'}
                </div>
              );
            })()
            : (() => {
              const filteredGroups = groups.filter(g =>
                g.name?.toLowerCase().includes(contactSearch.toLowerCase())
              );
              return (
                <>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="w-full text-center p-3 rounded-lg border-2 border-dashed border-indigo-500 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 mb-2 transition"
                  >
                    + Create Group Chat
                  </button>
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((g, idx) => {
                      const unreadCount = unreadCounts[g.id] || 0;
                      return (
                        <button
                          key={g.id}
                          onClick={() => handleGroupSelect(g)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setSidebarContextMenu({
                              mouseX: e.clientX,
                              mouseY: e.clientY,
                              type: 'GROUP',
                              data: g
                            });
                          }}
                          className={`w-full text-left p-3 rounded-lg transition slide-up border relative ${
                            selectedGroup?.id === g.id 
                              ? (darkMode ? 'bg-indigo-700 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-900 border-indigo-600')
                              : (darkMode ? 'bg-gray-700 text-gray-200 border-gray-600/50 hover:bg-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100 hover:border-gray-300')
                          }`}
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white relative">
                              <Users className="w-5 h-5" />
                              {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                  {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {g.name}
                              </p>
                              <p className={`text-xs ${
                                selectedGroup?.id === g.id
                                  ? (darkMode ? 'text-indigo-200' : 'text-indigo-700')
                                  : (darkMode ? 'text-gray-400' : 'text-gray-600')
                              }`}>
                                {g.members?.length || 0} members
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className={`text-center py-8 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {contactSearch ? 'No groups match your search.' : 'No groups'}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`lg:col-span-3 rounded-lg shadow flex flex-col overflow-hidden transition-opacity duration-300 border ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
        } ${showChatArea ? 'opacity-100' : 'opacity-0'}`}>
          {currentRecipient ? (
            <>
              {/* Header */}
              <div className={`p-4 border-b flex items-center gap-3 flex-shrink-0 scale-in ${
                darkMode ? 'border-gray-700' : 'border-gray-300'
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
                      <div className="relative flex-shrink-0">
                        {imageUrl ? (
                          <button
                            onClick={() => {
                              if (chatType === 'DIRECT' && selectedReceiver) {
                                setProfileModalUserId(selectedReceiver.id);
                              }
                            }}
                            className={`transition ${chatType === 'DIRECT' ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                          >
                            <img
                              key={imageUrl}
                              src={imageUrl}
                              alt={chatType === 'DIRECT' ? currentRecipient.username : (chatType === 'TEAM' ? currentRecipient.teamName : currentRecipient.name)}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                                ((e.target as HTMLElement).nextSibling as HTMLElement).style.display = 'flex';
                              }}
                            />
                          </button>
                        ) : null}
                        
                        {/* Fallback Icon for Header */}
                        <button
                          onClick={() => {
                            if (chatType === 'DIRECT' && selectedReceiver) {
                              setProfileModalUserId(selectedReceiver.id);
                            }
                          }}
                          className={`w-10 h-10 rounded-full ${
                            chatType === 'DIRECT'
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:opacity-80 cursor-pointer'
                              : chatType === 'TEAM'
                                ? 'bg-gradient-to-br from-green-500 to-teal-600 cursor-default'
                                : 'bg-gradient-to-br from-blue-500 to-indigo-600 cursor-default'
                          } flex items-center justify-center text-white font-bold transition`}
                          style={{ display: imageUrl ? 'none' : 'flex' }}
                        >
                          {chatType === 'DIRECT' 
                            ? <User className="w-5 h-5" />
                            : <Users className="w-5 h-5" />}
                        </button>

                        {/* Activity Status Indicator for Direct Chats */}
                        {chatType === 'DIRECT' && selectedReceiver && (
                          <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 ${darkMode ? 'border-gray-800' : 'border-white'} rounded-full ${getStatusColor(userStatuses[selectedReceiver.id] || contacts.find(c => c.id === selectedReceiver.id)?.status || selectedReceiver.status)}`}></span>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        {isRenamingGroup ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={renameGroupName}
                              onChange={e => setRenameGroupName(e.target.value)}
                              className={`px-2 py-1 text-sm rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'}`}
                              autoFocus
                            />
                            <button onClick={handleRenameGroup} className="p-1 bg-green-500 text-white rounded hover:bg-green-600">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setIsRenamingGroup(false)} className="p-1 bg-red-500 text-white rounded hover:bg-red-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <h3 className={`font-semibold ${
                            darkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            {chatType === 'DIRECT' ? currentRecipient.username : chatType === 'TEAM' ? currentRecipient.teamName : currentRecipient.name}
                          </h3>
                        )}
                        <p className={`text-xs ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {chatType === 'DIRECT'
                            ? currentRecipient.role
                            : chatType === 'TEAM'
                              ? `Team Chat • ${currentRecipient.memberCount || 0} members`
                              : `Group Chat • ${currentRecipient.members?.length || 0} members`}
                        </p>
                      </div>

                      {(chatType === 'GROUP' || chatType === 'TEAM') && (() => {
                        const membersList = chatType === 'GROUP' ? selectedGroup?.members : selectedTeam?.members;
                        if (!membersList) return null;

                        return (
                          <div className="flex items-center gap-2 ml-auto relative">
                            <button
                              onClick={() => setShowGroupMembersDropdown(!showGroupMembersDropdown)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 border shadow-sm hover:shadow-md ${darkMode ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300'}`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              {chatType === 'GROUP' ? 'Members' : 'Team Members'}
                            </button>
                            
                            {showGroupMembersDropdown && (
                              <div className={`absolute top-full right-0 mt-2 w-64 rounded-lg shadow-lg border z-50 overflow-hidden ${
                                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                              }`}>
                                <div className={`p-2 border-b text-xs font-semibold ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                                  {chatType === 'GROUP' ? 'Group' : 'Team'} Members ({membersList.length})
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  {membersList.map((member: any) => {
                                    const mName = member.userName || member.username;
                                    const mImage = member.userProfileImageUrl || contacts.find(c => String(c.id) === String(member.userId))?.profileImageUrl;
                                    return (
                                      <div key={member.userId} className={`flex items-center gap-3 p-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-50'} transition cursor-pointer`}
                                           onClick={() => {
                                              setProfileModalUserId(member.userId);
                                              setShowGroupMembersDropdown(false);
                                           }}>
                                        {mImage ? (
                                          <img src={getProfileImageUrl(mImage)} alt={mName} className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600`}>
                                            {mName?.[0]?.toUpperCase() || 'U'}
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {mName}
                                          </p>
                                          {member.role === 'ADMIN' && (
                                            <p className="text-xs text-indigo-500 font-semibold mt-0.5">Admin</p>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {chatType === 'GROUP' && (
                              <>
                                {String(selectedGroup?.creatorId) === String(user.id) || user.role === 'ADMIN' ? (
                                  <button 
                                    onClick={() => {
                                      setRenameGroupName(selectedGroup.name);
                                      setIsRenamingGroup(true);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 border shadow-sm hover:shadow-md ${darkMode ? 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Rename
                                  </button>
                                ) : null}
                                {String(selectedGroup?.creatorId) === String(user.id) ? (
                                  <button
                                    onClick={handleDeleteGroup}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 border shadow-sm hover:shadow-md ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50' : 'bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete Group
                                  </button>
                                ) : (
                                  <button
                                    onClick={handleLeaveGroup}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 border shadow-sm hover:shadow-md ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50' : 'bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'}`}
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Leave
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
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
                          onContextMenu={(e) => {
                            if (isSent) {
                              e.preventDefault();
                              setContextMenu({
                                mouseX: e.clientX,
                                mouseY: e.clientY,
                                message: msg,
                              });
                            }
                          }}
                          className={`flex gap-3 ${isSent ? 'justify-end slide-in-right' : 'justify-start slide-in-left'}`}
                        >
                          {!isSent && (
                            <div className="relative flex-shrink-0 w-8 h-8">
                              <button 
                                onClick={() => setProfileModalUserId(msg.senderId)}
                                className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold relative overflow-hidden transition transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                title={`View ${msg.senderName}'s profile`}
                              >
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
                              </button>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-[1.5px] ${darkMode ? 'border-gray-800' : 'border-white'} rounded-full z-20 ${getStatusColor(userStatuses[msg.senderId] || contacts.find(c => String(c.id) === String(msg.senderId))?.status || 'OFFLINE')}`}></span>
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
                            {(chatType === 'TEAM' || chatType === 'GROUP') && !isSent && (
                              <div className="mb-1 pb-1 border-b border-white/10">
                                <p className="text-xs font-semibold opacity-90">
                                  {msg.senderName || 'Unknown'}
                                </p>
                              </div>
                            )}
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              {msg.isEdited && (
                                <span className="text-[10px] opacity-70 italic mr-1">(edited)</span>
                              )}
                              <p className="text-xs opacity-75">
                                {parseUTCDate(msg.createdAt).toLocaleTimeString([], {
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
                            <div className="relative flex-shrink-0 w-8 h-8">
                              <button 
                                onClick={() => setProfileModalUserId(user.id)}
                                className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold relative overflow-hidden transition transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                title="View your profile"
                              >
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
                              </button>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-[1.5px] ${darkMode ? 'border-gray-800' : 'border-white'} rounded-full z-20 ${getStatusColor(userStatuses[user.id] || user?.status || 'ONLINE')}`}></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className={`flex flex-col items-center justify-center h-full fade-in ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
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
                darkMode ? 'border-gray-700' : 'border-gray-300'
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
              darkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <MessageSquare className={`w-16 h-16 mb-4 ${
                darkMode ? 'text-gray-600' : 'text-gray-300'
              }`} />
              <p>Select a {chatType.toLowerCase()} to start chatting</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Chat Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Create Group Chat</h2>
              <button onClick={() => setShowCreateGroup(false)} className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="p-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-indigo-500 outline-none`}
                  placeholder="e.g. Project Alpha"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Select Members</label>
                <div className="relative mb-2">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or role..."
                    value={groupMemberSearch}
                    onChange={(e) => setGroupMemberSearch(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                </div>
                <div className={`max-h-48 overflow-y-auto border rounded-lg p-2 ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                  {(() => {
                    const filteredMembers = contacts.filter(c => 
                      c.username?.toLowerCase().includes(groupMemberSearch.toLowerCase()) || 
                      c.role?.toLowerCase().includes(groupMemberSearch.toLowerCase())
                    );
                    
                    return filteredMembers.length === 0 ? (
                      <p className={`text-sm text-center py-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {groupMemberSearch ? 'No matching contacts found' : 'No contacts available'}
                      </p>
                    ) : (
                      filteredMembers.map(contact => (
                        <label key={contact.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={newGroupMembers.includes(contact.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewGroupMembers([...newGroupMembers, contact.id]);
                              } else {
                                setNewGroupMembers(newGroupMembers.filter(id => id !== contact.id));
                              }
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{contact.username} <span className="opacity-75 text-xs">({contact.role})</span></span>
                        </label>
                      ))
                    );
                  })()}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Group Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rename Group Chat</h2>
              <button onClick={() => setShowRenameModal(false)} className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSidebarRenameGroupSubmit} className="p-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>New Group Name</label>
                <input
                  type="text"
                  required
                  value={sidebarRenameName}
                  onChange={(e) => setSidebarRenameName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-indigo-500 outline-none`}
                  placeholder="e.g. Project Alpha"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!sidebarRenameName.trim()}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Profile Modal */}
      <EmployeeProfileModal 
        userId={profileModalUserId} 
        isOpen={!!profileModalUserId} 
        onClose={() => setProfileModalUserId(null)} 
      />

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className={`fixed z-50 rounded-lg shadow-xl border w-40 overflow-hidden ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
          style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
        >
          <button 
            onClick={() => {
              setEditingMessage(contextMenu.message);
              setMessageText(contextMenu.message.message);
              setContextMenu(null);
              if (inputRef.current) inputRef.current.focus();
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition ${
              darkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          <button 
            onClick={async () => {
              try {
                await chatAPI.deleteMessage(contextMenu.message.id);
                setMessages(prev => prev.filter(m => String(m.id) !== String(contextMenu.message.id)));
              } catch (e) {
                console.error('Failed to delete message', e);
              }
              setContextMenu(null);
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition text-red-500 ${
              darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      {/* Sidebar Context Menu */}
      {sidebarContextMenu && (
        <div 
          className={`fixed z-50 rounded-lg shadow-xl border w-44 overflow-hidden ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
          style={{ top: sidebarContextMenu.mouseY, left: sidebarContextMenu.mouseX }}
        >
          {sidebarContextMenu.type === 'DIRECT' ? (
            <button 
              onClick={async () => {
                const target = sidebarContextMenu.data;
                const isConfirmed = await confirm({
                  title: 'Delete Chat',
                  message: `Are you sure you want to clear the conversation history with ${target.username}?`,
                  confirmText: 'Delete',
                  variant: 'danger'
                });
                if (isConfirmed) {
                  setHiddenContactIds(prev => {
                    const updated = prev.includes(target.id) ? prev : [...prev, target.id];
                    localStorage.setItem('chat_hidden_contacts', JSON.stringify(updated));
                    return updated;
                  });
                  setMessages([]);
                  setSelectedReceiver(null);
                  showToast('Conversation removed from list successfully!', 'success');
                }
                setSidebarContextMenu(null);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition text-red-500 ${
                darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <Trash2 className="w-4 h-4" /> Delete Chat
            </button>
          ) : (
            <>
              <button 
                onClick={() => {
                  const target = sidebarContextMenu.data;
                  setRenameTargetGroup(target);
                  setSidebarRenameName(target.name || '');
                  setShowRenameModal(true);
                  setSidebarContextMenu(null);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                  darkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-750'
                }`}
              >
                <Edit2 className="w-4 h-4" /> Rename Group
              </button>
              
              <button 
                onClick={async () => {
                  const target = sidebarContextMenu.data;
                  const isConfirmed = await confirm({
                    title: 'Leave Group',
                    message: `Are you sure you want to leave ${target.name}?`,
                    confirmText: 'Leave',
                    variant: 'danger'
                  });
                  if (isConfirmed) {
                    try {
                      const response = await fetch(`/api/chat/group/${target.id}/leave`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                      });
                      if (response.ok) {
                        setGroups(prev => prev.filter(g => g.id !== target.id));
                        if (selectedGroup && selectedGroup.id === target.id) {
                          setSelectedGroup(null);
                          setChatType('DIRECT');
                        }
                        showToast('Left group successfully!', 'success');
                      } else {
                        showToast('Failed to leave group', 'error');
                      }
                    } catch (e) {
                      console.error('Failed to leave group', e);
                      showToast('Failed to leave group', 'error');
                    }
                  }
                  setSidebarContextMenu(null);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition text-red-500 ${
                  darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <LogOut className="w-4 h-4" /> Leave Group
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatPage;