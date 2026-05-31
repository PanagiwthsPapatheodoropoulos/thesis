import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, Loader, RefreshCw, X } from 'lucide-react';
import { aiAPI, assignmentsAPI } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from './Toast';
import type { Task } from '../types';

interface AIBulkPlannerModalProps {
  isOpen: boolean;
  tasks: Task[];
  onClose: () => void;
  onApplied?: () => void;
}

interface PlannedAssignment {
  taskId: string;
  taskTitle: string;
  employeeId: string;
  employeeName: string;
  fitScore: number;
  confidenceScore: number;
  reasoning?: string;
}

const AIBulkPlannerModal: React.FC<AIBulkPlannerModalProps> = ({ isOpen, tasks, onClose, onApplied }) => {
  const { darkMode } = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [optimizeWorkload, setOptimizeWorkload] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlannedAssignment[]>([]);

  const eligibleTasks = useMemo(
    () => tasks.filter(task => task.status !== 'COMPLETED' && !task.isArchived),
    [tasks]
  );

  const excludedTasks = useMemo(
    () => tasks.filter(task => task.status === 'COMPLETED' || task.isArchived),
    [tasks]
  );

  const fetchPlan = async () => {
    if (eligibleTasks.length === 0) {
      setPlan([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await aiAPI.bulkOptimize({
        taskIds: eligibleTasks.map(task => task.id),
        optimizeWorkload
      });

      const assignments = response?.assignments || [];

      interface RawBulkAssignment {
        task_id?: string;
        taskId?: string;
        task_title?: string;
        taskTitle?: string;
        employee_id?: string;
        employeeId?: string;
        employee_name?: string;
        employeeName?: string;
        fit_score?: number;
        fitScore?: number;
        confidence_score?: number;
        confidenceScore?: number;
        reasoning?: string;
      }

      const mapped: PlannedAssignment[] = assignments.map((assignment: RawBulkAssignment) => ({
        taskId: assignment.task_id || assignment.taskId || '',
        taskTitle: assignment.task_title || assignment.taskTitle || 'Untitled Task',
        employeeId: assignment.employee_id || assignment.employeeId || '',
        employeeName: assignment.employee_name || assignment.employeeName || 'Unassigned',
        fitScore: Number(assignment.fit_score ?? assignment.fitScore ?? 0),
        confidenceScore: Number(assignment.confidence_score ?? assignment.confidenceScore ?? 0),
        reasoning: assignment.reasoning
      }));

      setPlan(mapped);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Failed to generate AI plan');
      setPlan([]);
    } finally {
      setLoading(false);
    }
  };

  const applyPlan = async () => {
    const validPlan = plan.filter(item => item.taskId && item.employeeId);
    const skippedCount = plan.length - validPlan.length;

    if (validPlan.length === 0) {
      showToast('No assignments to apply.', 'warning');
      return;
    }

    setApplying(true);
    try {
      const results = await Promise.allSettled(
        validPlan.map(item =>
          assignmentsAPI.create({
            taskId: item.taskId,
            employeeId: item.employeeId,
            assignedBy: 'AI',
            fitScore: item.fitScore,
            confidenceScore: item.confidenceScore,
            notes: item.reasoning || 'AI bulk assignment plan'
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        showToast(`Created ${successCount} assignments.`, 'success');
      }
      if (failCount > 0) {
        showToast(`${failCount} assignments failed.`, 'warning');
      }
      if (skippedCount > 0) {
        showToast(`Skipped ${skippedCount} items without a valid assignee.`, 'warning');
      }

      onApplied?.();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(errMsg || 'Failed to apply assignments', 'error');
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPlan();
    } else {
      setPlan([]);
      setError(null);
      setLoading(false);
      setApplying(false);
    }
  }, [isOpen, optimizeWorkload]);

  if (!isOpen) return null;

  const containerClass = darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const panelClass = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden ${containerClass}`}>
        <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Bulk Assignment Planner</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Optimize assignments across selected tasks
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className={`rounded-lg border p-4 flex flex-wrap items-center justify-between gap-4 ${panelClass}`}>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={optimizeWorkload}
                  onChange={(e) => setOptimizeWorkload(e.target.checked)}
                  className="h-4 w-4"
                />
                Balance team workload
              </label>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {optimizeWorkload ? 'Genetic optimizer' : 'Greedy best-fit'}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchPlan}
              disabled={loading}
              className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>

          {excludedTasks.length > 0 && (
            <div className={`flex items-start gap-3 rounded-lg border p-4 ${darkMode ? 'bg-amber-900/20 border-amber-700 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <div className="text-sm">
                {excludedTasks.length} tasks were skipped because they are completed or archived.
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader className={`w-10 h-10 animate-spin ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <p className={`mt-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Building the optimal assignment plan...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className={`flex items-start gap-3 rounded-lg border p-4 ${darkMode ? 'bg-red-900/30 border-red-700 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!loading && !error && plan.length === 0 && (
            <div className={`rounded-lg border p-6 text-center ${panelClass}`}>
              <p className="text-sm">Select active tasks to generate an assignment plan.</p>
            </div>
          )}

          {!loading && !error && plan.length > 0 && (
            <div className="space-y-3">
              {plan.map((item, index) => (
                <div
                  key={`${item.taskId}-${index}`}
                  className={`rounded-xl border p-4 ${panelClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.taskTitle}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Assigned to {item.employeeName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-purple-900/40 text-purple-200' : 'bg-purple-100 text-purple-700'}`}>
                        Fit {Math.round(item.fitScore * 100)}%
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-600 border border-gray-200'}`}>
                        Confidence {Math.round(item.confidenceScore * 100)}%
                      </span>
                    </div>
                  </div>
                  {item.reasoning && (
                    <p className={`mt-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {item.reasoning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`px-6 py-4 border-t flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {plan.length} assignments ready
          </div>
          <button
            type="button"
            onClick={applyPlan}
            disabled={loading || applying || plan.length === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-60"
          >
            {applying ? 'Applying...' : 'Apply Plan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIBulkPlannerModal;
