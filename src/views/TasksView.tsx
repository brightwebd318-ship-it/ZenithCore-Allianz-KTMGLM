import React, { useEffect, useState } from 'react';
import {
  Kanban,
  Plus,
  Search,
  RefreshCw,
  Clock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { dataService, subscribeToTable } from '../services/dataService';
import type { TodoTask, User as StaffUser } from '../services/dataService';

interface TasksViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
  currentUser: StaffUser | null;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  triggerRefresh,
  triggerRefreshKey,
  currentUser,
  selectedTaskId,
  setSelectedTaskId,
}) => {
  const [todoTasks, setTodoTasks] = useState<TodoTask[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  
  // Filters
  const [filterType, setFilterType] = useState<'MY' | 'ALL'>('MY');
  const [searchQuery, setSearchQuery] = useState('');

  // Lock filter for non-admins and default filter appropriately
  useEffect(() => {
    if (currentUser) {
      setFilterType(currentUser.position_role === 'Admin' ? 'ALL' : 'MY');
    }
  }, [currentUser]);

  // Task creation Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [realtimeNotify, setRealtimeNotify] = useState<string | null>(null);

  // Handle auto-switching filter and scrolling for selectedTaskId
  useEffect(() => {
    if (selectedTaskId && todoTasks.length > 0) {
      const targetTask = todoTasks.find(t => t.id === selectedTaskId);
      if (targetTask) {
        if (targetTask.assigned_to !== currentUser?.id && currentUser?.position_role === 'Admin' && filterType !== 'ALL') {
          setFilterType('ALL');
        }
        
        setTimeout(() => {
          const el = document.getElementById(`task-card-${selectedTaskId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);

        const timer = setTimeout(() => {
          setSelectedTaskId(null);
        }, 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedTaskId, todoTasks, currentUser]);

  const loadTasksData = async () => {
    try {
      const tasks = await dataService.getTodoTasks();
      setTodoTasks(tasks);
      
      const st = await dataService.getUsers();
      setStaff(st);
      
      // Default task assignee to current user or first staff
      if (st.length > 0) {
        const defaultAssignee = st.find(s => s.id === currentUser?.id) || st[0];
        setTaskAssignee(defaultAssignee.id);
      }
    } catch (err) {
      console.error('Failed to load tasks view data:', err);
    }
  };

  useEffect(() => {
    loadTasksData();
  }, [triggerRefreshKey, currentUser]);

  // Real-time listener registration for tasks channel
  useEffect(() => {
    const unsubscribe = subscribeToTable('todo_tasks', (payload) => {
      setRealtimeNotify(`Tasks board updated! Syncing view...`);
      setTimeout(() => setRealtimeNotify(null), 3000);
      loadTasksData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleTask = async (taskId: string) => {
    try {
      await dataService.toggleTodoTask(taskId);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Toggled completion status of task ID: ${taskId}`);
      triggerRefresh();
      loadTasksData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this task?");
    if (!confirmDelete) return;

    try {
      const task = todoTasks.find(t => t.id === taskId);
      if (!task) return;

      await dataService.deleteTodoTask(taskId);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Permanently deleted task: ${task.title}`);

      // Send notifications to assignee and all admins
      try {
        const users = await dataService.getUsers();
        const admins = users.filter(u => u.position_role === 'Admin');
        
        // Notify Assignee (if different from deleting user)
        if (task.assigned_to && task.assigned_to !== currentUser?.id) {
          await dataService.addNotification({
            user_id: task.assigned_to,
            title: 'Assigned Task Deleted',
            description: `The task "${task.title}" assigned to you was deleted by ${currentUser?.full_name || 'an administrator'}`,
          });
        }

        // Notify Admins (if different from deleting user)
        for (const admin of admins) {
          if (admin.id !== currentUser?.id) {
            await dataService.addNotification({
              user_id: admin.id,
              title: 'Workspace Task Deleted',
              description: `Task "${task.title}" was deleted by ${currentUser?.full_name || 'an administrator'}`,
            });
          }
        }
      } catch (notifErr) {
        console.warn("Failed to route task deletion notifications:", notifErr);
      }

      triggerRefresh();
      loadTasksData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskAssignee) return;

    setLoading(true);
    try {
      const creatorId = currentUser?.id || staff[0]?.id || '';
      await dataService.addTodoTask({
        title: taskTitle,
        description: taskDesc,
        assigned_to: taskAssignee,
        created_by: creatorId,
      });

      if (taskAssignee && taskAssignee !== currentUser?.id) {
        await dataService.addNotification({
          user_id: taskAssignee,
          title: 'New Task Assigned',
          description: `You have been assigned a new task: "${taskTitle}" by ${currentUser?.full_name || 'an administrator'}`,
        });
      }

      setTaskTitle('');
      setTaskDesc('');
      setShowTaskForm(false);
      
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Created logistics task: ${taskTitle}`);
      triggerRefresh();
      loadTasksData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = todoTasks.filter(task => {
    // 1. Assignee filtering
    if (filterType === 'MY' && currentUser) {
      if (task.assigned_to !== currentUser.id) return false;
    }
    // 2. Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = task.title?.toLowerCase().includes(q);
      const descMatch = task.description?.toLowerCase().includes(q);
      return titleMatch || descMatch;
    }
    return true;
  });

  const pendingTasks = filteredTasks.filter(t => String(t.status).toUpperCase() === 'PENDING');
  const completedTasks = filteredTasks.filter(t => String(t.status).toUpperCase() === 'COMPLETED');

  return (
    <div className="space-y-6">
      
      {/* Real-time alert bar */}
      {realtimeNotify && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-between shadow-lg transition-all duration-300">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{realtimeNotify}</span>
          </div>
          <span className="text-[9px] uppercase bg-emerald-700 px-2 py-0.5 rounded">Sync Gateway Active</span>
        </div>
      )}

      {/* Header controls card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-2.5">
            <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500">
              <Kanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Task Management</h2>
            </div>
          </div>

          <button
            onClick={() => setShowTaskForm(true)}
            className="flex items-center justify-center bg-brand-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-brand-600 shadow-md shadow-brand-500/15 transition-all self-start sm:self-center"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Assign Task
          </button>
        </div>

        {/* Filter and search actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          {currentUser?.position_role === 'Admin' ? (
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg dark:bg-slate-800 w-fit">
              <button
                onClick={() => setFilterType('MY')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  filterType === 'MY'
                    ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  filterType === 'ALL'
                    ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All Workspace Tasks
              </button>
            </div>
          ) : (
            <div className="bg-slate-100/50 dark:bg-slate-800/30 px-3 py-1.5 rounded-lg border border-slate-200/40 dark:border-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              📌 Viewing tasks assigned to you
            </div>
          )}

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 dark:bg-slate-800 dark:border-slate-750 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Kanban Board columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pending Column */}
        <div className="rounded-xl bg-slate-50/60 p-4 border border-slate-150 dark:bg-slate-900/20 dark:border-slate-800/80 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 dark:border-slate-800/80">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Pending Tasks ({pendingTasks.length})
            </span>
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {pendingTasks.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                <p className="text-xs text-slate-400 italic">No pending tasks. Clinic is running smooth!</p>
              </div>
            ) : (
              [...pendingTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(task => {
                const assignee = staff.find(st => st.id === task.assigned_to)?.full_name || 'Specialist';
                const creator = staff.find(st => st.id === task.created_by)?.full_name || 'Admin';
                const isSelected = task.id === selectedTaskId;

                return (
                  <div
                    key={task.id}
                    id={`task-card-${task.id}`}
                    className={`bg-white border rounded-lg p-4 shadow-sm dark:bg-slate-900 space-y-2.5 transition-all ${
                      isSelected
                        ? 'border-brand-500 ring-2 ring-brand-500/30 dark:border-brand-400'
                        : 'border-slate-200 dark:border-slate-800/60 hover:border-brand-500/35'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug flex-1">{task.title}</h4>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleToggleTask(task.id)}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{task.description}</p>
                    )}
                    
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[9px] text-slate-450 dark:text-slate-400">
                      <span className="flex items-center"><UserIcon className="h-3 w-3 mr-1 text-slate-400" /> Assignee: <strong className="ml-1 text-slate-700 dark:text-slate-200">{assignee}</strong></span>
                      <span>By: <strong className="text-slate-700 dark:text-slate-200">{creator}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Completed Column */}
        <div className="rounded-xl bg-slate-50/60 p-4 border border-slate-150 dark:bg-slate-900/20 dark:border-slate-800/80 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 dark:border-slate-800/80">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Completed Tasks ({completedTasks.length})
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {completedTasks.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-400 italic">No completed tasks yet.</p>
              </div>
            ) : (
              [...completedTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(task => {
                const assignee = staff.find(st => st.id === task.assigned_to)?.full_name || 'Specialist';
                const creator = staff.find(st => st.id === task.created_by)?.full_name || 'Admin';
                const isSelected = task.id === selectedTaskId;

                return (
                  <div
                    key={task.id}
                    id={`task-card-${task.id}`}
                    className={`border rounded-lg p-4 shadow-xs space-y-2.5 opacity-75 transition-all ${
                      isSelected
                        ? 'bg-brand-50/50 border-brand-500 ring-2 ring-brand-500/30 dark:bg-brand-950/20 dark:border-brand-400'
                        : 'bg-slate-50/50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 line-through leading-snug flex-1">{task.title}</h4>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => handleToggleTask(task.id)}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed line-through">{task.description}</p>
                    )}
                    
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[9px] text-slate-450 dark:text-slate-450">
                      <span>Assignee: <strong>{assignee}</strong></span>
                      <span>By: <strong>{creator}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Task Creation Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Assign New Logistics Task</h3>
              <button onClick={() => setShowTaskForm(false)} className="text-white/80 hover:text-white text-xs font-bold">Close</button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-850 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  placeholder="e.g. Call patient to confirm MRI"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Body / Description</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-slate-200 p-2 text-xs bg-slate-50 dark:bg-slate-850 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  placeholder="Detail task activities or milestones..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assigned Staff</label>
                <select
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-850 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.position_role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTaskForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-xs font-semibold text-slate-500 hover:text-slate-700 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-700 transition-all shadow disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
