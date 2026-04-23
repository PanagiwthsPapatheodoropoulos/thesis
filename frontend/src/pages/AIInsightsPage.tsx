/**
 * @file AIInsightsPage.jsx
 * @description Page component displaying AI-driven insights, metrics, top performers, and skill utilization.
 */
// frontend/src/pages/AIInsightsPage.jsx - FIXED REAL-TIME VERSION
import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, AlertTriangle, TrendingUp, Target, Award, Users, 
  Activity, RefreshCw, Sparkles, ShieldAlert, BookOpen,
  Zap, CheckCircle, XCircle
} from 'lucide-react';
import { aiAPI, skillsAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import SkillRadarChart from '../components/SkillRadarChart';
import { useWebSocket, EVENT_TYPES } from '../contexts/WebSocketProvider';
import type { DashboardStats, WorkloadData } from '../types';

/**
 * AIInsightsPage Component
 * 
 * Displays productivity analytics, skill metrics, anomalies, and AI recommendations.
 * Supports real-time updates via WebSockets with debouncing.
 * 
 * @returns {React.ReactElement} The AI Insights page UI.
 */
const AIInsightsPage = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const { connected, ready, subscribe } = useWebSocket();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { darkMode } = useTheme();
  const [analytics, setAnalytics] = useState<Record<string, any> | null>(null);
  const [anomalies, setAnomalies] = useState({
    tasks: [],
    employees: [],
    skillGaps: [],
    workloadImbalance: [],
    complexityMismatch: []
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [skillNameMap, setSkillNameMap] = useState<Record<string, any>>({});
  
  // Use a debounce queue instead of simple cooldown
  const updateQueueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const DEBOUNCE_DELAY = 1000; // 1 second debounce

  /**
   * Fetches fresh AI insights and anomaly data.
   * 
   * @async
   * @function fetchAIInsights
   * @param {boolean} [bustCache=false] - Whether to bypass cache and force a fresh fetch.
   * @returns {Promise<void>}
   */
  const fetchAIInsights = async (bustCache = false) => {
    const isManualRefresh = bustCache;
    
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      const analyticsData = await aiAPI.getProductivityAnalytics(30, bustCache);

      setAnalytics(analyticsData);

      // Fetch skill name mapping
      const allSkills = await skillsAPI.getAll();
      const nameMap = {};
      allSkills.forEach(skill => {
        nameMap[skill.id] = skill.name;
      });
      setSkillNameMap(nameMap);

      // Fetch all anomalies in parallel
      const [taskAnomalies, empAnomalies, skillGapAnomalies, workloadAnomalies, complexityAnomalies] = 
        await Promise.all([
          aiAPI.detectAnomalies({ entityType: 'TASK', entityId: 'all' }, bustCache).catch(() => ({ results: [] })),
          aiAPI.detectAnomalies({ entityType: 'EMPLOYEE', entityId: 'all' }, bustCache).catch(() => ({ results: [] })),
          aiAPI.detectAnomalies({ entityType: 'SKILL_GAP', entityId: 'all' }, bustCache).catch(() => ({ results: [] })),
          aiAPI.detectAnomalies({ entityType: 'WORKLOAD_IMBALANCE', entityId: 'all' }, bustCache).catch(() => ({ results: [] })),
          aiAPI.detectAnomalies({ entityType: 'COMPLEXITY_MISMATCH', entityId: 'all' }, bustCache).catch(() => ({ results: [] }))
        ]);

      setAnomalies({
        tasks: taskAnomalies.results || [],
        employees: empAnomalies.results || [],
        skillGaps: skillGapAnomalies.results || [],
        workloadImbalance: workloadAnomalies.results || [],
        complexityMismatch: complexityAnomalies.results || []
      });

      setLastUpdated(new Date());
    } catch (error: any) {
      setError(error.message || 'Failed to load AI insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
      lastFetchTimeRef.current = Date.now();
    }
  };

  /**
   * Processes queued updates after a delay to batch rapid real-time events.
   * Debounces multiple WebSocket events into a single API fetch.
   * 
   * @async
   * @function processUpdateQueue
   * @returns {Promise<void>}
   */
  const processUpdateQueue = async () => {
    if (isProcessingRef.current || updateQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    const now = Date.now();
    
    // Clear the queue
    const eventCount = updateQueueRef.current.length;
    updateQueueRef.current = [];
        
    try {
      //ALWAYS use cache busting for real-time updates
      await fetchAIInsights(true);
    } catch (error: any) {
      console.error('Real-time update failed:', error);
    } finally {
      isProcessingRef.current = false;
      
      // If more events came in while processing, schedule another update
      if (updateQueueRef.current.length > 0) {
        setTimeout(processUpdateQueue, DEBOUNCE_DELAY);
      }
    }
  };

  /**
   * Queues an update event triggered by a WebSocket message and starts the debounce timer.
   * 
   * @function queueUpdate
   * @param {string} eventType - The type of event that triggered the update.
   */
  const queueUpdate = (eventType) => {
    updateQueueRef.current.push({ eventType, timestamp: Date.now() });
    
    // Start processing after debounce delay
    setTimeout(() => {
      if (!isProcessingRef.current) {
        processUpdateQueue();
      }
    }, DEBOUNCE_DELAY);
  };

  /**
   * Handles manual refresh triggered by the user.
   * Clears the update queue and forces a fully fresh data fetch.
   * 
   * @function handleManualRefresh
   */
  const handleManualRefresh = () => {
    // Clear any pending updates
    updateQueueRef.current = [];
    isProcessingRef.current = false;
    fetchAIInsights(true);
  };

  /**
   * INITIAL LOAD
   */
  useEffect(() => {
    fetchAIInsights(false); // Don't bust cache on initial load
  }, []); 

  /**
   * WEBSOCKET SUBSCRIPTIONS - Queue updates instead of immediate fetch
   */
  useEffect(() => {
    if (!ready) {
      return;
    }
        
    const unsubs = [
      // Task status changes
      subscribe(EVENT_TYPES.TASK_STATUS_CHANGED, (data: any) => {
        queueUpdate('TASK_STATUS_CHANGED');
      }),
      
      // Task created
      subscribe(EVENT_TYPES.TASK_CREATED, (data: any) => {
        queueUpdate('TASK_CREATED');
      }),
      
      // Task approved
      subscribe(EVENT_TYPES.TASK_APPROVED, (data: any) => {
        queueUpdate('TASK_APPROVED');
      }),
      
      // Assignment created
      subscribe(EVENT_TYPES.ASSIGNMENT_CREATED, (data: any) => {
        queueUpdate('ASSIGNMENT_CREATED');
      }),
      
      // Assignment accepted
      subscribe(EVENT_TYPES.ASSIGNMENT_ACCEPTED, (data: any) => {
        queueUpdate('ASSIGNMENT_ACCEPTED');
      })
    ];
    
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [ready, subscribe]);

  /**
   * Gets the appropriate CSS classes for a given anomaly severity level.
   * 
   * @function getSeverityColor
   * @param {string} severity - The severity level (e.g., 'HIGH', 'MEDIUM', 'LOW').
   * @returns {string} The CSS class-string for the severity color scheme.
   */
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'HIGH': return darkMode ? 'border-red-700 bg-red-900/30 text-red-200' : 'border-red-300 bg-red-50 text-red-900';
      case 'MEDIUM': return darkMode ? 'border-orange-700 bg-orange-900/30 text-orange-200' : 'border-orange-300 bg-orange-50 text-orange-900';
      case 'LOW': return darkMode ? 'border-yellow-700 bg-yellow-900/30 text-yellow-200' : 'border-yellow-300 bg-yellow-50 text-yellow-900';
      default: return darkMode ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-300 bg-gray-50 text-gray-900';
    }
  };

  /**
   * Gets the corresponding icon element for a given anomaly severity level.
   * 
   * @function getSeverityIcon
   * @param {string} severity - The severity level.
   * @returns {React.ReactElement} The lucide-react icon component.
   */
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'HIGH': return <ShieldAlert className={`w-6 h-6 ${darkMode ? 'text-red-500' : 'text-red-600'}`} />;
      case 'MEDIUM': return <AlertTriangle className={`w-6 h-6 ${darkMode ? 'text-orange-500' : 'text-orange-600'}`} />;
      case 'LOW': return <AlertTriangle className={`w-6 h-6 ${darkMode ? 'text-yellow-500' : 'text-yellow-600'}`} />;
      default: return <AlertTriangle className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />;
    }
  };

  const totalAnomalies = 
    anomalies.tasks.length + 
    anomalies.employees.length + 
    anomalies.skillGaps.length +
    anomalies.workloadImbalance.length +
    anomalies.complexityMismatch.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? 'border-indigo-500' : 'border-indigo-600'} mb-4`} />
        <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Loading AI Insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <XCircle className={`w-16 h-16 ${darkMode ? 'text-red-500' : 'text-red-600'} mb-4`} />
        <p className={`text-xl font-bold ${darkMode ? 'text-red-300' : 'text-red-900'} mb-2`}>Failed to Load AI Insights</p>
        <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>{error}</p>
        <button
          onClick={() => fetchAIInsights(true)}
          className={`px-4 py-2 rounded-lg transition ${
            darkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700'
          } text-white`}
        >
          Try Again
        </button>
      </div>
    );
  }

  const companyMetrics = analytics?.company_metrics || {};
  const topPerformers = analytics?.top_performers || [];
  const skillInsights = analytics?.skill_insights || [];
  const recommendations = analytics?.recommendations || [];

  return (
    <div className={`space-y-6 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold flex items-center gap-3 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <Brain className={`w-8 h-8 ${darkMode ? 'text-purple-500' : 'text-purple-600'}`} />
            AI Insights Dashboard
            <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-full flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Powered by ML
            </span>
          </h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            AI-driven analytics, anomaly detection, and recommendations
            {lastUpdated && (
              <span className={`ml-3 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                • Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {/*Real-time indicator */}
            <span className={`ml-3 flex items-center gap-1 text-xs ${
              ready ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-yellow-400' : 'text-yellow-600')
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${ready ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {ready ? 'Real-time updates active' : 'Connecting...'}
            </span>
            {/* Show if updates are pending */}
            {updateQueueRef.current.length > 0 && (
              <span className={`ml-3 text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                • {updateQueueRef.current.length} update(s) pending...
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            refreshing
              ? darkMode 
                ? 'bg-purple-800 cursor-not-allowed' 
                : 'bg-purple-400 cursor-not-allowed'
              : darkMode 
                ? 'bg-purple-700 hover:bg-purple-600 text-white' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Insights'}
        </button>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className={`rounded-lg shadow p-4 border-l-4 border-blue-500 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Target className={`w-5 h-5 ${darkMode ? 'text-blue-500' : 'text-blue-600'}`} />
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Completion Rate</p>
            </div>
            <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {((companyMetrics.task_completion_rate || 0) * 100).toFixed(0)}%
            </p>
          </div>

          <div className={`rounded-lg shadow p-4 border-l-4 border-green-500 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Award className={`w-5 h-5 ${darkMode ? 'text-green-500' : 'text-green-600'}`} />
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>On-Time Rate</p>
            </div>
            <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {((companyMetrics.on_time_delivery_rate || 0) * 100).toFixed(0)}%
            </p>
          </div>

          <div className={`rounded-lg shadow p-4 border-l-4 border-purple-500 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Activity className={`w-5 h-5 ${darkMode ? 'text-purple-500' : 'text-purple-600'}`} />
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Skill Utilization</p>
            </div>
            <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {((companyMetrics.avg_skill_utilization || 0) * 100).toFixed(0)}%
            </p>
          </div>

          <div className={`rounded-lg shadow p-4 border-l-4 border-red-500 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-5 h-5 ${darkMode ? 'text-red-500' : 'text-red-600'}`} />
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Anomalies Detected</p>
            </div>
            <p className={`text-3xl font-bold ${darkMode ? 'text-red-500' : 'text-red-600'}`}>{totalAnomalies}</p>
          </div>

          <div className={`rounded-lg shadow p-4 border-l-4 border-purple-500 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Zap className={`w-5 h-5 ${darkMode ? 'text-purple-500' : 'text-purple-600'}`} />
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Real-Time Learning
              </p>
            </div>
            <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Active
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Updates after every 5 completions
            </p>
          </div>
        </div>
      )}

      <div className={`rounded-lg shadow ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className={`flex overflow-x-auto ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle, badge: totalAnomalies },
            { id: 'skills', label: 'Skill Insights', icon: BookOpen },
            { id: 'recommendations', label: 'Recommendations', icon: Target }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? darkMode
                      ? 'border-b-2 border-purple-500 text-purple-500'
                      : 'border-b-2 border-purple-600 text-purple-600'
                    : darkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 rounded-lg border-2 ${
                  darkMode
                    ? 'border-purple-800 bg-gradient-to-br from-purple-900/50 to-purple-800/30'
                    : 'border-purple-200 bg-gradient-to-br from-white to-purple-50'
                }`}>
                  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <TrendingUp className={`w-5 h-5 ${darkMode ? 'text-purple-500' : 'text-purple-600'}`} />
                    Productivity Metrics
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Avg Completion Time</span>
                      <span className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{(companyMetrics.avg_completion_time || 0).toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Tasks Completed</span>
                      <span className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{companyMetrics.total_tasks_completed || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Tasks Overdue</span>
                      <span className={`font-bold ${darkMode ? 'text-red-500' : 'text-red-600'}`}>{companyMetrics.total_tasks_overdue || 0}</span>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-lg border-2 ${
                  darkMode
                    ? 'border-blue-800 bg-gradient-to-br from-blue-900/50 to-blue-800/30'
                    : 'border-blue-200 bg-gradient-to-br from-white to-blue-50'
                }`}>
                  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <Zap className={`w-5 h-5 ${darkMode ? 'text-blue-500' : 'text-blue-600'}`} />
                    Skill Metrics
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Skill Utilization</span>
                      <span className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{((companyMetrics.avg_skill_utilization || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Skill Diversity</span>
                      <span className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{(companyMetrics.skill_diversity_score || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {topPerformers.length > 0 && (
                <div>
                  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <Award className={`w-5 h-5 ${darkMode ? 'text-yellow-500' : 'text-yellow-600'}`} />
                    Top Performers
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {topPerformers.slice(0, 3).map((emp: any, idx) => (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{emp.employee_name}</span>
                          <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Score</span>
                            <span className={`font-semibold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>{emp.productivity_score}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Tasks</span>
                            <span className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{emp.tasks_completed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Skills Used</span>
                            <span className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{emp.skills_utilized}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!topPerformers.length && !Object.keys(companyMetrics).length && (
                <div className={`text-center py-12 rounded-lg border-2 ${
                  darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <Activity className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`text-xl font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No Analytics Data Available</p>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>Complete some tasks to generate insights</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-4">
              {skillInsights.length > 0 ? (
                <>
                  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                    darkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    <BookOpen className={`w-5 h-5 ${darkMode ? 'text-blue-500' : 'text-blue-600'}`} />
                    Skill Usage Across Company
                  </h3>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className={`rounded-lg p-4 border-2 ${
                      darkMode 
                        ? 'bg-gradient-to-br from-blue-900/50 to-blue-900/30 border-blue-700' 
                        : 'bg-gradient-to-br from-white to-blue-50 border-blue-200'
                    }`}>
                      <div className={`text-sm mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Total Skills</div>
                      <div className={`text-3xl font-bold ${darkMode ? 'text-blue-100' : 'text-blue-900'}`}>
                        {skillInsights.length}
                      </div>
                    </div>
                    <div className={`rounded-lg p-4 border-2 ${
                      darkMode 
                        ? 'bg-gradient-to-br from-red-900/50 to-red-900/30 border-red-700' 
                        : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
                    }`}>
                      <div className={`text-sm mb-1 ${darkMode ? 'text-red-300' : 'text-red-700'}`}>High Demand</div>
                      <div className={`text-3xl font-bold ${darkMode ? 'text-red-100' : 'text-red-900'}`}>
                        {skillInsights.filter(s => s.demand_level === 'HIGH').length}
                      </div>
                    </div>
                    <div className={`rounded-lg p-4 border-2 ${
                      darkMode 
                        ? 'bg-gradient-to-br from-green-900/50 to-green-900/30 border-green-700' 
                        : 'bg-gradient-to-br from-green-50 to-green-100 border-green-300'
                    }`}>
                      <div className={`text-sm mb-1 ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Avg Proficiency</div>
                      <div className={`text-3xl font-bold ${darkMode ? 'text-green-100' : 'text-green-900'}`}>
                        {skillInsights.length > 0 
                          ? (skillInsights.reduce((sum, s) => sum + (s.avg_proficiency || 0), 0) / skillInsights.length).toFixed(1)
                          : 0}/5
                      </div>
                    </div>
                  </div>

                  {skillInsights.length > 0 && (
                    <div className="mt-8">
                      <SkillRadarChart 
                        skills={skillInsights.map(s => ({ 
                          name: skillNameMap[s.skill_name] || s.skill_name,
                          proficiencyLevel: s.avg_proficiency 
                        }))} 
                        darkMode={darkMode} 
                        title="Overall Skill Proficiency Distribution" 
                      />
                    </div>
                  )}
                  <div className="mt-6">
                    {skillInsights.map((skill: any, idx) => {
                      const displayName = skillNameMap[skill.skill_name] || skill.skill_name;
                      
                      return (
                        <div key={idx} className={`p-4 rounded-lg border-2 ${
                          darkMode
                            ? 'border-gray-700 bg-gray-800'
                            : 'border-gray-300 bg-gradient-to-br from-white to-gray-50'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                              {displayName}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              skill.demand_level === 'HIGH' 
                                ? darkMode 
                                  ? 'bg-red-900/50 text-red-200' 
                                  : 'bg-red-100 text-red-800'
                                : skill.demand_level === 'MEDIUM' 
                                  ? darkMode 
                                    ? 'bg-yellow-900/50 text-yellow-200' 
                                    : 'bg-yellow-100 text-yellow-800'
                                  : darkMode 
                                    ? 'bg-green-900/50 text-green-200' 
                                    : 'bg-green-100 text-green-800'
                            }`}>
                              {skill.demand_level} DEMAND
                            </span>
                          </div>
                          <div className={`flex gap-6 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <div>Usage: <strong className={darkMode ? 'text-gray-200' : 'text-gray-800'}>{skill.usage_count} tasks</strong></div>
                            <div>Avg Proficiency: <strong className={darkMode ? 'text-gray-200' : 'text-gray-800'}>{(skill.avg_proficiency || 0).toFixed(1)}/5</strong></div>
                          </div>
                          <div className={`mt-2 w-full rounded-full h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div 
                              className={`h-2 rounded-full ${darkMode ? 'bg-blue-500' : 'bg-blue-600'}`}
                              style={{ width: `${((skill.avg_proficiency || 0) / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className={`text-center py-12 rounded-lg border-2 ${
                  darkMode 
                    ? 'bg-gray-800/50 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <BookOpen className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`text-xl font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No Skill Data Available</p>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>Add employee skills to see insights</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {recommendations.length > 0 ? (
                recommendations.map((rec: any, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border-2 ${
                    rec.includes('⚠️') || rec.includes('🚨') 
                      ? darkMode ? 'border-yellow-700 bg-yellow-900/30' : 'border-yellow-300 bg-yellow-50'
                      : rec.includes('✅') || rec.includes('🏆') 
                        ? darkMode ? 'border-green-700 bg-green-900/30' : 'border-green-300 bg-green-50'
                        : darkMode ? 'border-blue-700 bg-blue-900/30' : 'border-blue-300 bg-blue-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <Target className={`w-5 h-5 mt-0.5 ${darkMode ? 'text-indigo-500' : 'text-indigo-600'}`} />
                      <p className={`flex-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{rec}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`text-center py-12 rounded-lg border-2 ${
                  darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <Target className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`text-xl font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No Recommendations Available</p>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>Complete more tasks to generate AI recommendations</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'anomalies' && (
            <div className="space-y-6">
              {anomalies.tasks.length > 0 && (
                <div>
                  <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <AlertTriangle className={`w-5 h-5 ${darkMode ? 'text-red-500' : 'text-red-600'}`} />
                    Task Anomalies ({anomalies.tasks.length})
                  </h3>
                  <div className="space-y-3">
                    {anomalies.tasks.map((anomaly: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(anomaly.severity)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 text-xs font-bold rounded ${
                                anomaly.severity === 'HIGH' 
                                  ? darkMode ? 'bg-red-800/50 text-red-200' : 'bg-red-200 text-red-800'
                                  : anomaly.severity === 'MEDIUM' 
                                    ? darkMode ? 'bg-orange-800/50 text-orange-200' : 'bg-orange-200 text-orange-800'
                                    : darkMode ? 'bg-yellow-800/50 text-yellow-200' : 'bg-yellow-200 text-yellow-800'
                              }`}>
                                {anomaly.severity}
                              </span>
                              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Score: {anomaly.anomaly_score?.toFixed(2) || 'N/A'}
                              </span>
                            </div>
                            <p className={`font-medium mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{anomaly.description}</p>
                            {anomaly.metrics && (
                              <div className="flex gap-4 text-sm flex-wrap">
                                {Object.entries(anomaly.metrics).map(([key, value]: [string, any]) => (
                                  <span key={key} className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                                    {key.replace(/_/g, ' ')}: <strong className={darkMode ? 'text-gray-100' : 'text-gray-900'}>{typeof value === 'number' ? value.toFixed(1) : value}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {anomalies.employees.length > 0 && (
                <div>
                  <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <Users className={`w-5 h-5 ${darkMode ? 'text-orange-500' : 'text-orange-600'}`} />
                    Employee Performance Anomalies ({anomalies.employees.length})
                  </h3>
                  <div className="space-y-3">
                    {anomalies.employees.map((anomaly: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(anomaly.severity)}
                          <div className="flex-1">
                            <p className={`font-medium mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{anomaly.description}</p>
                            {anomaly.metrics && (
                              <div className="flex gap-4 text-sm flex-wrap">
                                {Object.entries(anomaly.metrics).map(([key, value]: [string, any]) => (
                                  <span key={key} className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                                    {key.replace(/_/g, ' ')}: <strong className={darkMode ? 'text-gray-100' : 'text-gray-900'}>{typeof value === 'number' ? value.toFixed(1) : value}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {anomalies.skillGaps.length > 0 && (
                <div>
                  <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <BookOpen className={`w-5 h-5 ${darkMode ? 'text-blue-500' : 'text-blue-600'}`} />
                    Skill Gap Issues ({anomalies.skillGaps.length})
                  </h3>
                  <div className="space-y-3">
                    {anomalies.skillGaps.map((anomaly: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(anomaly.severity)}
                          <div className="flex-1">
                            <p className={`font-medium mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{anomaly.description}</p>
                            {anomaly.metrics?.recommendation && (
                              <div className={`mt-2 p-2 rounded text-sm ${
                                darkMode ? 'bg-blue-900/50 text-blue-200' : 'bg-blue-100 text-blue-900'
                              }`}>
                                💡 <strong>Recommendation:</strong> {anomaly.metrics.recommendation}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {anomalies.workloadImbalance.length > 0 && (
                <div>
                  <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <Activity className={`w-5 h-5 ${darkMode ? 'text-purple-500' : 'text-purple-600'}`} />
                    Workload Imbalances ({anomalies.workloadImbalance.length})
                  </h3>
                  <div className="space-y-3">
                    {anomalies.workloadImbalance.map((anomaly: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(anomaly.severity)}
                          <div className="flex-1">
                            <p className={`font-medium mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{anomaly.description}</p>
                            {anomaly.metrics && (
                              <div className={`grid grid-cols-2 gap-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {anomaly.metrics.avg_workload && (
                                  <div>Avg Workload: <strong className={darkMode ? 'text-gray-100' : 'text-gray-900'}>{anomaly.metrics.avg_workload}%</strong></div>
                                )}
                                {anomaly.metrics.std_deviation && (
                                  <div>Std Dev: <strong className={darkMode ? 'text-gray-100' : 'text-gray-900'}>{anomaly.metrics.std_deviation}</strong></div>
                                )}
                                {anomaly.metrics.overloaded_count !== undefined && (
                                  <div>Overloaded: <strong className={darkMode ? 'text-red-500' : 'text-red-600'}>{anomaly.metrics.overloaded_count}</strong></div>
                                )}
                                {anomaly.metrics.underloaded_count !== undefined && (
                                  <div>Underloaded: <strong className={darkMode ? 'text-yellow-500' : 'text-yellow-600'}>{anomaly.metrics.underloaded_count}</strong></div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {anomalies.complexityMismatch.length > 0 && (
                <div>
                  <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    <Target className={`w-5 h-5 ${darkMode ? 'text-indigo-500' : 'text-indigo-600'}`} />
                    Task-Skill Mismatches ({anomalies.complexityMismatch.length})
                  </h3>
                  <div className="space-y-3">
                    {anomalies.complexityMismatch.map((anomaly: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(anomaly.severity)}
                          <div className="flex-1">
                            <p className={`font-medium mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{anomaly.description}</p>
                            {anomaly.metrics && (
                              <div className={`flex gap-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {anomaly.metrics.task_complexity && (
                                  <div>Task Complexity: <strong className={darkMode ? 'text-gray-100' : 'text-gray-900'}>{anomaly.metrics.task_complexity}</strong></div>
                                )}
                                {anomaly.metrics.employee_skill_level && (
                                  <div>Employee Skill: <strong className={darkMode ? 'text-gray-100' : 'text-gray-900'}>{anomaly.metrics.employee_skill_level}</strong></div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalAnomalies === 0 && (
                <div className={`text-center py-12 rounded-lg border-2 ${
                  darkMode ? 'bg-green-900/30 border-green-800' : 'bg-green-50 border-green-200'
                }`}>
                  <CheckCircle className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-green-500' : 'text-green-600'}`} />
                  <p className={`text-xl font-bold ${darkMode ? 'text-green-200' : 'text-green-900'}`}>✨ All Clear!</p>
                  <p className={`${darkMode ? 'text-green-400' : 'text-green-700'} mt-2`}>No anomalies detected. System is performing optimally.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInsightsPage;