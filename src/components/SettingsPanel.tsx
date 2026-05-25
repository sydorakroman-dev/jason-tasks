import { useState } from 'react';
import { Plus, Trash2, GripVertical, Check, X, User, Sun, Moon, Monitor } from 'lucide-react';
import type { Status, Priority, Tag, Person, Block } from '../types';
import type { AppStore } from '../store/useAppStore';

interface Props { store: AppStore; onClose: () => void; }

const PRESET_COLORS = [
  // Reds
  '#fca5a5','#f87171','#ef4444','#dc2626','#991b1b',
  // Oranges
  '#fdba74','#fb923c','#f97316','#ea580c','#9a3412',
  // Yellows
  '#fde047','#facc15','#eab308','#ca8a04','#854d0e',
  // Greens
  '#86efac','#4ade80','#22c55e','#16a34a','#14532d',
  // Teals
  '#5eead4','#2dd4bf','#14b8a6','#0d9488','#134e4a',
  // Blues
  '#93c5fd','#60a5fa','#3b82f6','#2563eb','#1e3a8a',
  // Indigos
  '#a5b4fc','#818cf8','#6366f1','#4f46e5','#312e81',
  // Purples
  '#d8b4fe','#c084fc','#a855f7','#9333ea','#581c87',
  // Pinks
  '#f9a8d4','#f472b6','#ec4899','#db2777','#831843',
  // Grays
  '#e5e7eb','#d1d5db','#9ca3af','#6b7280','#374151',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[repeat(5,20px)] gap-x-1.5 gap-y-1.5 auto-rows-[20px]" style={{ gridTemplateColumns: 'repeat(10, 20px)' }}>
        {PRESET_COLORS.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className="w-5 h-5 rounded-full border-2 transition hover:scale-110"
            style={{ backgroundColor: c, borderColor: value.toLowerCase() === c ? '#111' : 'transparent' }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5"
          title="Custom color"
        />
        <input
          type="text"
          value={value}
          onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
          className="w-24 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="#000000"
          spellCheck={false}
        />
        <span className="w-5 h-5 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: value }} />
      </div>
    </div>
  );
}

function EditableRow({ label, color, onUpdate, onDelete, renderPreview }: {
  label: string; color?: string;
  onUpdate: (data: { label: string; color?: string }) => void;
  onDelete: () => void;
  renderPreview: (label: string, color?: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [l, setL] = useState(label);
  const [c, setC] = useState(color ?? '#6b7280');

  const save = () => { onUpdate({ label: l, ...(color !== undefined ? { color: c } : {}) }); setEditing(false); };
  const cancel = () => { setL(label); setC(color ?? '#6b7280'); setEditing(false); };

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2">
        <input autoFocus className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={l} onChange={e => setL(e.target.value)} />
        {color !== undefined && <ColorPicker value={c} onChange={setC} />}
        <div className="flex gap-2">
          <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
            <Check size={12} /> Save
          </button>
          <button onClick={cancel} className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 group">
      <GripVertical size={14} className="text-gray-300 dark:text-gray-600 cursor-grab shrink-0" />
      {renderPreview(label, color)}
      <div className="flex-1" />
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 text-xs">Edit</button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function PersonRow({ person, onUpdate, onDelete }: {
  person: Person; onUpdate: (d: Partial<Person>) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);

  const save = () => { onUpdate({ name, email }); setEditing(false); };
  const cancel = () => { setName(person.name); setEmail(person.email); setEditing(false); };

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2">
        <input autoFocus className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
        <input type="email" className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
            <Check size={12} /> Save
          </button>
          <button onClick={cancel} className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 group">
      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
        <User size={13} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{person.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{person.email}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 text-xs">Edit</button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function AddForm({ fields, onAdd, onCancel, colors = true }: {
  fields: { placeholder: string; type?: string }[];
  onAdd: (values: string[], color: string) => void;
  onCancel: () => void;
  colors?: boolean;
}) {
  const [values, setValues] = useState(fields.map(() => ''));
  const [color, setColor] = useState('#6b7280');

  const set = (i: number, v: string) => setValues(vs => { const n = [...vs]; n[i] = v; return n; });

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2">
      {fields.map((f, i) => (
        <input key={i} autoFocus={i === 0} type={f.type ?? 'text'}
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder={f.placeholder} value={values[i]} onChange={e => set(i, e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd(values, color)}
        />
      ))}
      {colors && <ColorPicker value={color} onChange={setColor} />}
      <div className="flex gap-2">
        <button onClick={() => onAdd(values, color)}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
          <Check size={12} /> Add
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
      </div>
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function SettingsPanel({ store, onClose }: Props) {
  const {
    state, updateSettings,
    addStatus, updateStatus, deleteStatus,
    addPriority, updatePriority, deletePriority,
    addTag, updateTag, deleteTag,
    addPerson, updatePerson, deletePerson,
    addBlock, updateBlock, deleteBlock,
  } = store;
  const { settings } = state;

  const [clientId, setClientId] = useState(settings.googleClientId);
  const [adding, setAdding] = useState<'status' | 'priority' | 'tag' | 'person' | 'block' | null>(null);
  const sortedBlocks = [...settings.blocks].sort((a, b) => a.order - b.order);

  const sortedStatuses   = [...settings.statuses].sort((a, b) => a.order - b.order);
  const sortedPriorities = [...settings.priorities].sort((a, b) => a.order - b.order);

  const THEME_OPTIONS = [
    { value: 'light' as const, icon: <Sun size={13} />, label: 'Light' },
    { value: 'dark'  as const, icon: <Moon size={13} />, label: 'Dark' },
    { value: 'system' as const, icon: <Monitor size={13} />, label: 'System' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto max-h-[75vh] px-6 py-5 space-y-8">

          {/* Theme */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Appearance</h3>
            <div className="flex items-center gap-2">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateSettings({ theme: opt.value })}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition ${
                    settings.theme === opt.value
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Google Calendar */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Google Calendar</h3>
            <div className="space-y-2">
              <input
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="123456789-xxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Create a project at <span className="font-mono">console.cloud.google.com</span>, enable the Calendar API,
                and add your domain to Authorized JavaScript origins.
              </p>
              <button onClick={() => updateSettings({ googleClientId: clientId })}
                className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition">
                Save
              </button>
            </div>
          </section>

          {/* People / Delegates */}
          <Section title="People & Delegates" onAdd={() => setAdding('person')}>
            {settings.people.map(p => (
              <PersonRow key={p.id} person={p} onUpdate={d => updatePerson(p.id, d)} onDelete={() => deletePerson(p.id)} />
            ))}
            {settings.people.length === 0 && adding !== 'person' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No people yet — add teammates to delegate tasks to them.</p>
            )}
            {adding === 'person' && (
              <AddForm
                fields={[{ placeholder: 'Full name' }, { placeholder: 'Email', type: 'email' }]}
                colors={false}
                onAdd={([name, email]) => {
                  if (!name.trim()) return;
                  addPerson({ id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), name: name.trim(), email: email.trim() });
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
          </Section>

          {/* Statuses */}
          <Section title="Statuses" onAdd={() => setAdding('status')}>
            {sortedStatuses.map(s => (
              <EditableRow key={s.id} label={s.label} color={s.color}
                onUpdate={d => updateStatus(s.id, d as Partial<Status>)}
                onDelete={() => deleteStatus(s.id)}
                renderPreview={(label, color) => (
                  <>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                  </>
                )}
              />
            ))}
            {adding === 'status' && (
              <AddForm
                fields={[{ placeholder: 'Status label...' }]}
                onAdd={([label], color) => {
                  if (!label.trim()) return;
                  addStatus({ id: label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), label: label.trim(), color, order: settings.statuses.length });
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
          </Section>

          {/* Priorities */}
          <Section title="Priorities" onAdd={() => setAdding('priority')}>
            {sortedPriorities.map(p => (
              <EditableRow key={p.id} label={p.label} color={p.color}
                onUpdate={d => updatePriority(p.id, d as Partial<Priority>)}
                onDelete={() => deletePriority(p.id)}
                renderPreview={(label, color) => (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={{ backgroundColor: color + '20', color, borderColor: color + '44' }}>
                    {label}
                  </span>
                )}
              />
            ))}
            {adding === 'priority' && (
              <AddForm
                fields={[{ placeholder: 'Priority label...' }]}
                onAdd={([label], color) => {
                  if (!label.trim()) return;
                  addPriority({ id: label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), label: label.trim(), color, order: settings.priorities.length });
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
          </Section>

          {/* Tags */}
          <Section title="Tags" onAdd={() => setAdding('tag')}>
            {settings.tags.map(t => (
              <EditableRow key={t.id} label={t.label} color={t.color}
                onUpdate={d => updateTag(t.id, d as Partial<Tag>)}
                onDelete={() => deleteTag(t.id)}
                renderPreview={(label, color) => (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44` }}>
                    {label}
                  </span>
                )}
              />
            ))}
            {adding === 'tag' && (
              <AddForm
                fields={[{ placeholder: 'Tag label...' }]}
                onAdd={([label], color) => {
                  if (!label.trim()) return;
                  addTag({ id: label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), label: label.trim(), color });
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
          </Section>

          {/* Task Blocks */}
          <Section title="Task Blocks" onAdd={() => setAdding('block')}>
            {sortedBlocks.map(b => (
              <EditableRow key={b.id} label={b.label} color={b.color}
                onUpdate={d => updateBlock(b.id, d as Partial<Block>)}
                onDelete={() => deleteBlock(b.id)}
                renderPreview={(label, color) => (
                  <>
                    <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-gray-700 font-medium">{label}</span>
                  </>
                )}
              />
            ))}
            {adding === 'block' && (
              <AddForm
                fields={[{ placeholder: 'Block label...' }]}
                onAdd={([label], color) => {
                  if (!label.trim()) return;
                  addBlock({ id: label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), label: label.trim(), color, order: settings.blocks.length });
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
          </Section>

        </div>
      </div>
    </div>
  );
}
