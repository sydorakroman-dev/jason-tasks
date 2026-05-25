import { useState, useEffect } from 'react';
import { X, Calendar, Loader2, ChevronDown } from 'lucide-react';
import type { Goal, Task, AppSettings } from '../types';
import { createCalendarEvent, initGoogleApi } from '../utils/googleCalendar';

type FormData = {
  title: string;
  description: string;
  priorityId: string;
  statusId: string;
  dueDate: string;
  tags: string[];
  assignedTo: string;
};

interface Props {
  mode: 'goal' | 'task';
  initial?: Partial<Goal | Task>;
  settings: AppSettings;
  onSave: (data: FormData) => void;
  onClose: () => void;
  onCalendarSync?: (eventId: string) => void;
  existingCalendarEventId?: string;
}

export function ItemForm({ mode, initial, settings, onSave, onClose, onCalendarSync, existingCalendarEventId }: Props) {
  const defaultPriorityId = settings.priorities.find(p => p.id === 'medium')?.id
    ?? settings.priorities[Math.floor(settings.priorities.length / 2)]?.id
    ?? settings.priorities[0]?.id
    ?? '';

  const [form, setForm] = useState<FormData>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    priorityId: (initial as any)?.priorityId ?? defaultPriorityId,
    statusId: initial?.statusId ?? settings.statuses[0]?.id ?? '',
    dueDate: initial?.dueDate ?? '',
    tags: initial?.tags ?? [],
    assignedTo: initial?.assignedTo ?? '',
  });
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState('');
  const [calSynced, setCalSynced] = useState(!!existingCalendarEventId);

  useEffect(() => { setCalSynced(!!existingCalendarEventId); }, [existingCalendarEventId]);

  const set = (key: keyof FormData, val: any) => setForm(f => ({ ...f, [key]: val }));

  const toggleTag = (id: string) =>
    set('tags', form.tags.includes(id) ? form.tags.filter(t => t !== id) : [...form.tags, id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
    onClose();
  };

  const handleCalendar = async () => {
    if (!settings.googleClientId) { setCalError('Add your Google Client ID in Settings first.'); return; }
    if (!form.dueDate) { setCalError('Set a due date first.'); return; }
    setCalLoading(true); setCalError('');
    try {
      await initGoogleApi(settings.googleClientId);
      const person = settings.people.find(p => p.id === form.assignedTo);
      const attendeeEmail = person?.email ?? (form.assignedTo.includes('@') ? form.assignedTo : undefined);
      const id = await createCalendarEvent({
        title: form.title || 'Untitled',
        description: form.description,
        dueDate: form.dueDate,
        attendeeEmail,
      });
      setCalSynced(true);
      onCalendarSync?.(id);
    } catch (e: any) {
      setCalError(e.message ?? 'Calendar sync failed');
    } finally {
      setCalLoading(false);
    }
  };

  const sortedPriorities = [...settings.priorities].sort((a, b) => a.order - b.order);
  const sortedStatuses  = [...settings.statuses].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {initial?.id ? 'Edit' : 'New'} {mode === 'goal' ? 'Goal' : 'Task'}
            {initial?.id && <span className="ml-2 text-xs font-mono text-gray-400 dark:text-gray-500">{initial.id}</span>}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <input
            autoFocus
            className="w-full text-lg font-medium border-0 border-b-2 border-gray-100 dark:border-gray-700 focus:border-indigo-400 focus:outline-none pb-1 placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-gray-100 dark:bg-transparent transition"
            placeholder={mode === 'goal' ? 'Goal title...' : 'Task title...'}
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />

          {/* Description */}
          <textarea
            rows={2}
            className="w-full text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />

          {/* Priority + Status */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Priority</label>
              <select
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={form.priorityId}
                onChange={e => set('priorityId', e.target.value)}
              >
                {sortedPriorities.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={form.statusId}
                onChange={e => set('statusId', e.target.value)}
              >
                {sortedStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Due date + Assigned to */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Due Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Delegate to</label>
              {settings.people.length > 0 ? (
                <select
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={form.assignedTo}
                  onChange={e => set('assignedTo', e.target.value)}
                >
                  <option value="">— none —</option>
                  {settings.people.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="email"
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="email... (add people in Settings)"
                  value={form.assignedTo}
                  onChange={e => set('assignedTo', e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Tags */}
          {settings.tags.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {settings.tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium border transition"
                    style={
                      form.tags.includes(tag.id)
                        ? { backgroundColor: tag.color, color: '#fff', borderColor: tag.color }
                        : { backgroundColor: tag.color + '18', color: tag.color, borderColor: tag.color + '44' }
                    }
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Google Calendar */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Calendar size={13} /> Google Calendar
              </span>
              {calSynced ? (
                <span className="text-xs text-emerald-600 font-medium">✓ Synced</span>
              ) : (
                <button
                  type="button"
                  onClick={handleCalendar}
                  disabled={calLoading}
                  className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {calLoading && <Loader2 size={11} className="animate-spin" />}
                  Add to Calendar
                </button>
              )}
            </div>
            {calError && <p className="mt-1.5 text-xs text-red-500">{calError}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
          <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">
            {initial?.id ? 'Save Changes' : `Create ${mode === 'goal' ? 'Goal' : 'Task'}`}
          </button>
        </div>
      </form>
    </div>
  );
}
