import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, Loader, X } from 'lucide-react';
import { aiAPI, tasksAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from './Toast';
import type { Task, TaskPriority } from '../types';

interface AIPrioritizerModalProps {
  isOpen: boolean;
  tasks: Task[];
  onClose: () => void;
  onApplied?: () => void;
}

interface PrioritizedItem {
  taskId: string | null;
  title: string;
  category?: string;
  riskLevel?: string;
  effortHours?: number;
  priorityScore: number;
  recommendation?: string;
  currentPriority?: TaskPriority;
}

const scoreToPriority = (score: number): TaskPriority => {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.6) return 'HIGH';
  if (score >= 0.4) return 'MEDIUM';
  return 'LOW';
};

const formatScore = (score: number) => `${Math.round(score * 100)}%`;

interface RawPrioritizedItem {
  task_id?: string;
  title?: string;
  category?: string;
  risk_level?: string;
  effort_hours?: number;
  priority_score?: number;
  rank_recommendation?: string;
}

const mapPrioritizedItems = (
  items: RawPrioritizedItem[],
  taskIdByTitle: Map<string, string>,
  taskById: Map<string, Task>
): PrioritizedItem[] => {
  return items.map((item) => {
    const taskId = item.task_id || taskIdByTitle.get(item.title || '') || null;
    const task = taskId ? taskById.get(taskId) : undefined;
    return {
      taskId,
      title: item.title || task?.title || 'Untitled Task',
      category: item.category,
      riskLevel: item.risk_level,
      effortHours: typeof item.effort_hours === 'number' ? item.effort_hours : undefined,
      priorityScore: typeof item.priority_score === 'number' ? item.priority_score : 0,
      recommendation: item.rank_recommendation,
      currentPriority: task?.priority
    };
  });
};

const AIPrioritizerModal: React.FC<AIPrioritizerModalProps> = ({ isOpen, tasks, onClose, onApplied }) => {
  const { darkMode } = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prioritized, setPrioritized] = useState<PrioritizedItem[]>([]);

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const taskIdByTitle = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(t => {
      if (!map.has(t.title)) {
        map.set(t.title, t.id);
      }
    });
    return map;
  }, [tasks]);

  const runPrioritizer = async () => {
    if (!tasks || tasks.length === 0) {
      setPrioritized([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = tasks.map(task => ({
        task_id: task.id,
        title: task.title,
        description: task.description || ''
      }));

      const response = await aiAPI.prioritizeBacklog(payload);
      const items = response?.prioritized || [];

      const mapped = mapPrioritizedItems(items, taskIdByTitle, taskById);

      setPrioritized(mapped);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Failed to prioritize backlog');
      setPrioritized([]);
    } finally {
      setLoading(false);
    }
  };

  const applyPriorities = async () => {
    const updates = prioritized.filter(item => {
      if (!item.taskId) return false;
      const suggested = scoreToPriority(item.priorityScore);
      return item.currentPriority && suggested !== item.currentPriority;
    });

    if (updates.length === 0) {
      showToast('All tasks already match the suggested priority.', 'info');
      return;
    }

    setApplying(true);
    try {
      const results = await Promise.allSettled(
        updates.map(item => {
          const id = item.taskId!;
          return tasksAPI.update(id, { priority: scoreToPriority(item.priorityScore) });
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        showToast(`Updated ${successCount} task priorities.`, 'success');
      }
      if (failCount > 0) {
        showToast(`${failCount} updates failed.`, 'warning');
      }

      onApplied?.();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(errMsg || 'Failed to apply priorities', 'error');
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runPrioritizer();
    } else {
      setPrioritized([]);
      setError(null);
      setLoading(false);
      setApplying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const containerClass = darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const panelClass = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden ${containerClass}`}>
        <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Backlog Prioritizer</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Ranked by complexity, risk, and effort
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader className={`w-10 h-10 animate-spin ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <p className={`mt-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Scoring tasks with AI...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className={`flex items-start gap-3 rounded-lg border p-4 ${darkMode ? 'bg-red-900/30 border-red-700 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!loading && !error && prioritized.length === 0 && (
            <div className={`rounded-lg border p-6 text-center ${panelClass}`}>
              <p className="text-sm">Select tasks to generate a priority list.</p>
            </div>
          )}

          {!loading && !error && prioritized.length > 0 && (
            <div className="space-y-3">
              {prioritized.map((item, index) => {
                const suggestedPriority = scoreToPriority(item.priorityScore);
                const changed = item.currentPriority && suggestedPriority !== item.currentPriority;

                return (
                  <div
                    key={item.taskId || item.title}
                    className={`rounded-xl border p-4 flex flex-col gap-3 ${panelClass}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">#{index + 1} {item.title}</p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.category || 'General'} • Risk: {item.riskLevel || 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-indigo-900/40 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
                          Score {formatScore(item.priorityScore)}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-600 border border-gray-200'}`}>
                          Suggest {suggestedPriority}
                        </div>
                        {changed && (
                          <div className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-amber-900/40 text-amber-200' : 'bg-amber-100 text-amber-700'}`}>
                            Update from {item.currentPriority}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {typeof item.effortHours === 'number' && (
                        <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Effort: {item.effortHours.toFixed(1)}h
                        </span>
                      )}
                      {item.recommendation && (
                        <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Recommendation: {item.recommendation}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`px-6 py-4 border-t flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={runPrioritizer}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Refresh Scores
          </button>
          <button
            type="button"
            onClick={applyPriorities}
            disabled={loading || applying || prioritized.length === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60"
          >
            {applying ? 'Applying...' : 'Apply AI Priorities'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIPrioritizerModal;
