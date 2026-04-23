/**
 * @fileoverview ChatbotWidget - Floating AI Assistant Chat Panel.
 *
 * Renders a fixed-position chat bubble that expands into a full chat panel
 * powered by the Ollama-based AI service. Supports text messaging, text-to-speech
 * output, microphone-based voice input, and automatic AI service health polling.
 * Shows role-specific greeting messages on first open.
 */
// src/components/ChatbotWidget.jsx
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2, Mic, MicOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { chatbotAPI } from '../utils/api';
import type { ChatbotWidgetProps } from '../types';

/**
 * Floating AI assistant widget providing a STOMP-independent chat interface.
 * Polls the AI service health endpoint and auto-retries every 3 seconds until connected.
 * @component
 * @returns {JSX.Element|null} The chatbot bubble or panel, or null if not authenticated.
 */
const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [retryCount, setRetryCount] = useState<number>(0);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const { user } = useAuth();
  const location = useLocation();

  /** Scrolls the message list to the latest message. */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Reset conversation when the active account changes to avoid stale role greetings.
  useEffect(() => {
    setMessages([]);
    setInput('');
    setIsTyping(false);
    setIsMinimized(false);
  }, [user?.id, user?.username, user?.role]);

  // Keep retrying every 3 seconds until connected
  useEffect(() => {
    let isComponentMounted = true;
    let checkInterval;
    
    const checkHealth = async () => {
      if (!isComponentMounted) return;
      
      try {
        const data = await chatbotAPI.health();
        
        if (data.status === 'healthy' && isComponentMounted) {
          setConnectionStatus('connected');
          setRetryCount(0);
          
          // Once connected, check every 60 seconds
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkHealth, 60000);
        } else {
          throw new Error('Not healthy');
        }
      } catch (error: any) {
        if (!isComponentMounted) return;
        
        setConnectionStatus('checking');
        setRetryCount(prev => prev + 1);
        
        // Keep trying every 3 seconds
        if (checkInterval) clearInterval(checkInterval);
        checkInterval = setInterval(checkHealth, 3000);
      }
    };

    checkHealth();

    return () => {
      isComponentMounted = false;
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  /**
   * Manually triggers an immediate health check and resets the retry counter.
   * Called when the user clicks the retry connection button.
   */
  const checkOllamaHealth = async () => {
    setConnectionStatus('checking');
    setRetryCount(0);
    
    try {
      const data = await chatbotAPI.health();
      
      if (data.status === 'healthy') {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
      }
    } catch (error: any) {
      setConnectionStatus('checking');
    }
  };

  /**
   * Returns a human-readable label for the user's current page,
   * used to inject page context into the AI query.
   * @returns {string} A descriptive page name.
   */
  const getCurrentPageContext = () => {
    const path = location.pathname;
    const pageMap = {
        'dashboard': 'dashboard',
        'tasks': 'tasks management page',
        'employees': 'employee management page',
        'teams': 'teams management page',
        'workload': 'workload monitoring page',
        'ai-insights': 'AI insights and analytics page',
        'assignments': 'task assignments page',
        'chat': 'team chat page',
        'notifications': 'notifications page',
        'settings': 'settings page',
        'profile': 'profile page'
    };
    
    for (const [key, label] of Object.entries(pageMap)) {
        if (path.includes(key)) return label;
    }
    return 'main dashboard';
  };

  /**
   * Appends a bot message to the conversation and optionally speaks it aloud.
   * @param {string} text - The message text to display.
   * @param {*} [action=null] - Optional structured action payload attached to the message.
   */
  const addBotMessage = (text, action = null) => {
    setMessages(prev => [...prev, { 
      type: 'bot', 
      text, 
      action, 
      timestamp: new Date() 
    }]);
    
    if (soundEnabled) {
      speakText(text);
    }
  };

  useEffect(() => {
    if (isOpen && messages.length === 0 && connectionStatus === 'connected') {
      const roleGreetings = {
          'ADMIN': `👋 Hi ${user?.username}! You have **full admin access**.\n\nOn this page you can:\n• Create tasks, manage employees & teams\n• Use AI assignment suggestions & predictions\n• View anomalies and productivity analytics\n• Manage users and system settings\n\nWhat do you need help with?`,
          
          'MANAGER': `👋 Hi ${user?.username}! You have **manager access** for your teams.\n\nYou can:\n• Create & approve tasks for your teams\n• Use AI assignment tools\n• Monitor team workload\n\n⚠️ You cannot manage users or system settings — contact your Admin for that.\n\nHow can I help?`,
          
          'EMPLOYEE': `👋 Hi ${user?.username}! You have **employee access**.\n\nYou can:\n• View & update your assigned tasks\n• Request new tasks (needs manager approval)\n• Update your skills and profile\n• Chat with teammates\n\n⚠️ To create tasks or see analytics, ask your Manager.\n\nWhat do you need?`,
          
          'USER': `👋 Hi ${user?.username}! Your account is **pending setup**.\n\n⚠️ You don't have an employee profile yet.\n\nTo get started:\n1. Contact your company Admin\n2. Ask them to create your employee profile\n3. Once done, you'll get full access\n\nIs there anything I can explain while you wait?`
      };
      
      const greeting = roleGreetings[user?.role] || roleGreetings['USER'];
      addBotMessage(greeting);
    }
  }, [isOpen, connectionStatus, user?.username, user?.role]);

  /**
   * Reads the given text aloud using the Web Speech Synthesis API.
   * Strips markdown formatting before speaking to ensure clean output.
   * @param {string} text - The text to synthesize.
   */
  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/[*_#•\n]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 0.8;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  /**
   * Toggles microphone recording. On first call, requests microphone access
   * and starts recording. On second call (or after 10 seconds), stops recording
   * and sends the audio blob to the backend transcription endpoint.
   */
  const handleVoiceInput = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support audio recording.');
      return;
    }

    // If already recording, stop
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      recognitionRef.current = mediaRecorder;
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        
        // Create audio blob
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        // Send to backend for transcription
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        
        try {
          setIsTyping(true);
          
          const response = await fetch('http://localhost:5000/api/ai/voice/transcribe', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.text && data.text.trim()) {
            setInput(prev => prev + (prev ? " " : "") + data.text);
          } else {
            alert('No speech detected. Please try again.');
          }
          
        } catch (error: any) {
          alert('HTTPS needed.Action blocked by browsers');
        } finally {
          setIsTyping(false);
        }
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        setIsListening(false);
        recognitionRef.current = null;
      };

      // Start recording
      mediaRecorder.start();
      setIsListening(true);
      
      // Auto-stop after 10 seconds (optional)
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);

    } catch (error: any) {     
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert('Could not access microphone: ' + error.message);
      }
      
      setIsListening(false);
    }
  };

  /**
   * Sends the current input to the AI chatbot API and appends the response.
   * Sets the typing indicator while awaiting the response.
   */
  const handleSend = async () => {
    if (!input.trim() || isTyping || connectionStatus !== 'connected') return;

    const userText = input.trim();
    setMessages(prev => [...prev, { 
      type: 'user', 
      text: userText, 
      timestamp: new Date() 
    }]);
    setInput('');
    setIsTyping(true);

    try {
      const data = await chatbotAPI.query({
        query: userText,
        context: {
          role: user?.role || 'USER',
          page: getCurrentPageContext(),
          username: user?.username || 'User'
        }
      });

      setIsTyping(false);
      
      if (data.response) {
        addBotMessage(data.response);
      } else {
        addBotMessage("I couldn't generate a response. Please try again.");
      }

    } catch (error: any) {
      setIsTyping(false);
      
      let errorMessage = "I'm having trouble connecting right now. ";
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage += "Please check if the AI service is running.";
      } else {
        errorMessage += "Please try again in a moment.";
      }
      
      addBotMessage(errorMessage);
    }
  };

  /**
   * Submits the message when Enter is pressed (without Shift for multi-line).
   * @param {React.KeyboardEvent} e - The keydown event.
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSoundToggle = () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    
    if (!newSoundEnabled) {
      stopSpeaking();
    }
  };

  if (!user) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center z-50 group"
        title={
          connectionStatus === 'connected' ? 'Open AI Assistant' :
          'AI Assistant - Connecting...'
        }
      >
        <MessageCircle className="w-6 h-6" />
        {connectionStatus === 'connected' && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
        )}
        {connectionStatus === 'checking' && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all ${isMinimized ? 'w-80' : 'w-96'}`}>
      <div className={`bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-500/30 overflow-hidden ${isMinimized ? 'h-16' : 'h-[600px]'} flex flex-col`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center relative">
              <MessageCircle className="w-5 h-5 text-white" />
              {connectionStatus === 'connected' && (
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-purple-600"></span>
              )}
              {connectionStatus === 'checking' && (
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-purple-600 animate-pulse"></span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-white">AI Assistant</h3>
              <p className="text-xs text-white/70">
                {connectionStatus === 'connected' ? 'Powered by Phi-3' : 
                 `Connecting... (${retryCount})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === 'checking' && (
              <button 
                onClick={checkOllamaHealth}
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
                title="Retry connection"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
              </button>
            )}
            <button 
              onClick={handleSoundToggle}
              className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              title={soundEnabled ? "Disable sound" : "Enable sound"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setIsMinimized(!isMinimized)} 
              className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                setIsOpen(false);
                stopSpeaking();
              }}
              className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 shadow-md ${
                    msg.type === 'user' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-800 text-gray-100 border border-purple-500/20'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <span className="text-xs opacity-50 mt-1 block">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 border border-purple-500/20 rounded-2xl p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-purple-500/20 bg-slate-900/80">
              {connectionStatus === 'checking' && (
                <div className="mb-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 flex items-center justify-between">
                  <span>⏳ Connecting to AI service... ({retryCount})</span>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isListening ? "🎤 Listening... (click mic to stop)" : "Ask me anything..."}
                    disabled={isTyping || connectionStatus !== 'connected'}
                    className={`w-full bg-slate-800 border ${
                      isListening ? 'border-red-500 ring-2 ring-red-500/50' : 'border-purple-500/20'
                    } rounded-xl pl-4 pr-10 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  <button
                    onClick={handleVoiceInput}
                    disabled={isTyping || connectionStatus !== 'connected'}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      isListening 
                        ? 'text-red-500 bg-red-500/10 animate-pulse' 
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={isListening ? "Stop listening (click to stop)" : "Start voice input (click to start)"}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping || connectionStatus !== 'connected'}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatbotWidget;