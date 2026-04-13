import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { projects as staticProjects } from '../data/projects';

/* ─── Helpers ─── */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)));
}

function getDaysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function formatRelativeDate(dateStr) {
  const days = getDaysSince(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function parseCommitCategory(message) {
  const match = message.match(/^(data|docs|feat|fix|test|chore|refactor|style|perf)[\s:(!]/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

const CATEGORY_STYLES = {
  data: { bg: '#dfeee8', color: '#788c5d', label: 'data' },
  docs: { bg: '#f0eef8', color: '#4b3aa6', label: 'docs' },
  feat: { bg: '#dce8f4', color: '#6a9bcc', label: 'feat' },
  fix: { bg: '#fde8e8', color: '#8d2525', label: 'fix' },
  test: { bg: '#fce8f0', color: '#c46686', label: 'test' },
  chore: { bg: '#f5f4ed', color: '#73726c', label: 'chore' },
  refactor: { bg: '#ebdbbc', color: '#754600', label: 'refactor' },
  style: { bg: '#ebcece', color: '#c46686', label: 'style' },
  perf: { bg: '#c8ddd4', color: '#325c00', label: 'perf' },
};

const PROJECT_COLORS = {
  'cosmetic-ai': '#d97757',
  'anaconda-hub': '#6a9bcc',
  'colorist': '#788c5d',
  'pattern-viz': '#bcd1ca',
};

const TASK_STATUSES = ['todo', 'in-progress', 'done'];

/* ─── Sub-components ─── */

function ProgressBar({ percent, color, label }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color }}>{percent}%</span>
      </div>
      <div style={{ width: '100%', height: 8, background: '#e8e6dc', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, width: `${percent}%`, background: color,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '12px', color: 'var(--text-subtle)', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-subtle)' }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color, marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

function CategoryChip({ category }) {
  const style = CATEGORY_STYLES[category];
  if (!style) return null;
  return (
    <span style={{
      fontSize: '10px', padding: '2px 7px', borderRadius: 10, fontWeight: 600,
      background: style.bg, color: style.color, letterSpacing: '0.3px',
    }}>{style.label}</span>
  );
}

function TimelineItem({ dot, date, text, project, category }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{date}</span>
          {category && <CategoryChip category={category} />}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
        <span style={{
          fontSize: '11px', color: 'var(--text-subtle)', background: 'var(--bg-secondary)',
          padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4,
        }}>{project}</span>
      </div>
    </div>
  );
}

function FilterChips({ options, selected, onChange, colorMap }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {options.map(opt => {
        const isActive = selected === opt;
        const chipColor = colorMap?.[opt];
        return (
          <button key={opt} onClick={() => onChange(isActive ? 'All' : opt)} style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: 14, border: '1px solid var(--border)',
            background: isActive ? (chipColor || 'var(--text)') : 'transparent',
            color: isActive ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500,
            transition: 'all 0.15s',
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

function TaskItem({ task, onToggle }) {
  const priorityColors = { critical: '#d97757', high: '#6a9bcc', medium: '#bcd1ca' };
  const tagStyles = {
    Bug: { bg: '#fde8e8', color: '#8d2525' },
    Feature: { bg: '#dce8f4', color: '#6a9bcc' },
    Test: { bg: '#f0eef8', color: '#4b3aa6' },
    Polish: { bg: '#fce8f0', color: '#c46686' },
    Pipeline: { bg: '#dfeee8', color: '#788c5d' },
  };
  const tag = tagStyles[task.type] || tagStyles.Feature;
  const isDone = task.status === 'done';
  const statusIcon = isDone ? 'check_circle' : task.status === 'in-progress' ? 'pending' : 'radio_button_unchecked';
  const statusColor = isDone ? '#788c5d' : task.status === 'in-progress' ? '#6a9bcc' : '#d1cfc5';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      borderRadius: '8px', transition: 'background 0.15s',
      opacity: isDone ? 0.5 : 1,
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#f5f4ed'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <button onClick={() => onToggle(task)} title="Click to change status" style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: statusColor }}>{statusIcon}</span>
      </button>
      <div style={{ width: 4, height: 24, borderRadius: 2, background: priorityColors[task.priority], flexShrink: 0 }} />
      <span style={{
        fontSize: '13px', color: 'var(--text)', flex: 1,
        textDecoration: isDone ? 'line-through' : 'none',
      }}>{task.title}</span>
      <span style={{
        fontSize: '10px', padding: '3px 8px', borderRadius: 12, fontWeight: 500,
        background: tag.bg, color: tag.color,
      }}>{task.type}</span>
    </div>
  );
}

function AddTaskForm({ onSubmit }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Feature');
  const [priority, setPriority] = useState('high');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-subtle)', fontSize: '12px', fontFamily: 'var(--font-body)',
      }}
        onMouseEnter={e => e.currentTarget.style.color = '#d97757'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-subtle)'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>
        Add task
      </button>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit({ title, type, priority, status: 'todo' });
    setTitle(''); setIsOpen(false); setSubmitting(false);
  };

  const selectStyle = {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'white', fontSize: '12px', fontFamily: 'var(--font-body)', color: 'var(--text)', outline: 'none',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0' }}>
      <input placeholder="What needs doing?" value={title} onChange={e => setTitle(e.target.value)}
        autoFocus style={{ ...selectStyle, flex: 1 }} />
      <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
        {['Feature', 'Bug', 'Test', 'Polish', 'Pipeline'].map(t => <option key={t}>{t}</option>)}
      </select>
      <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
        {['critical', 'high', 'medium'].map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="submit" disabled={submitting || !title.trim()} style={{
        padding: '6px 14px', borderRadius: 6, background: '#d97757', border: 'none',
        color: 'white', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
        fontFamily: 'var(--font-body)', opacity: submitting || !title.trim() ? 0.5 : 1,
      }}>{submitting ? '...' : 'Add'}</button>
      <button type="button" onClick={() => setIsOpen(false)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
      </button>
    </form>
  );
}

function ProjectCard({ project }) {
  const daysSince = getDaysSince(project.lastWorked);
  const isStale = daysSince > 7;
  const statusColor = project.status === 'On Hold' ? '#9c9a92' : isStale ? '#d97757' : '#788c5d';
  const statusText = project.status === 'On Hold' ? 'On Hold' : isStale ? `${daysSince}d stale` : 'Active';
  const barColors = ['#788c5d', '#6a9bcc', '#bcd1ca', '#9c9a92'];
  const idx = staticProjects.indexOf(project);
  return (
    <Link to={`/app/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '12px', padding: '18px',
        border: '1px solid var(--border)', transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(20,20,19,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '13px', color: 'var(--text)', marginBottom: 6 }}>{project.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)', marginBottom: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {statusText}
          {project.priority && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 600, color: project.priority === 'P1' ? '#d97757' : '#9c9a92' }}>{project.priority}</span>}
        </div>
        <div style={{ width: '100%', height: 4, background: '#e8e6dc', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, width: `${project.progress}%`, background: barColors[idx % barColors.length], transition: 'width 0.6s ease' }} />
        </div>
      </div>
    </Link>
  );
}

/* ─── Feedback Form ─── */

function FeedbackForm({ onSubmit }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Bug');
  const [severity, setSeverity] = useState('Minor');
  const [steps, setSteps] = useState('');
  const [project, setProject] = useState('cosmetic-ai');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit({ title, type, severity, stepsToReproduce: steps, projectId: project, source: 'Dashboard' });
    setTitle(''); setSteps(''); setIsOpen(false); setSubmitting(false);
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
        background: 'var(--bg-secondary)', border: '1px dashed #d1cfc5', borderRadius: 12,
        cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-body)',
        width: '100%', transition: 'border-color 0.15s, background 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#d97757'; e.currentTarget.style.background = '#faf9f5'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1cfc5'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#d97757' }}>add_circle</span>
        Log a bug, idea, or issue
      </button>
    );
  }

  const selectStyle = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'white', fontSize: '13px', fontFamily: 'var(--font-body)',
    color: 'var(--text)', outline: 'none',
  };
  const inputStyle = { ...selectStyle, width: '100%' };

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--bg-secondary)', borderRadius: 12, padding: 20,
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>New Feedback</span>
        <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <input placeholder="What did you notice?" value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} autoFocus />
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <select value={project} onChange={e => setProject(e.target.value)} style={selectStyle}>
          {staticProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
          {['Bug', 'Feature Request', 'UX Issue', 'Risk'].map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={selectStyle}>
          {['Critical', 'Major', 'Minor', 'Cosmetic'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <textarea placeholder="Steps to reproduce or details (optional)" value={steps}
        onChange={e => setSteps(e.target.value)} rows={3} style={{ ...inputStyle, marginBottom: 12, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setIsOpen(false)} style={{
          padding: '8px 16px', borderRadius: 8, background: 'transparent',
          border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px',
          fontFamily: 'var(--font-body)', cursor: 'pointer',
        }}>Cancel</button>
        <button type="submit" disabled={submitting || !title.trim()} style={{
          padding: '8px 16px', borderRadius: 8, background: '#d97757',
          border: 'none', color: 'white', fontSize: '13px', fontWeight: 500,
          fontFamily: 'var(--font-body)', cursor: 'pointer',
          opacity: submitting || !title.trim() ? 0.5 : 1,
        }}>{submitting ? 'Saving...' : 'Submit'}</button>
      </div>
    </form>
  );
}

function FeedbackItem({ item, onStatusChange }) {
  const typeIcons = { Bug: 'bug_report', 'Feature Request': 'lightbulb', 'UX Issue': 'design_services', Risk: 'warning' };
  const typeColors = { Bug: '#8d2525', 'Feature Request': '#6a9bcc', 'UX Issue': '#c46686', Risk: '#a86b00' };
  const sevStyles = {
    Critical: { bg: '#fde8e8', color: '#8d2525' }, Major: { bg: '#fff3e0', color: '#a86b00' },
    Minor: { bg: '#f5f4ed', color: '#73726c' }, Cosmetic: { bg: '#f5f4ed', color: '#9c9a92' },
  };
  const statusStyles = {
    New: { bg: '#fde8e8', color: '#8d2525' }, Triaged: { bg: '#fff3e0', color: '#a86b00' },
    'In Progress': { bg: '#dce8f4', color: '#6a9bcc' }, Fixed: { bg: '#dfeee8', color: '#788c5d' },
    "Won't Fix": { bg: '#f5f4ed', color: '#73726c' },
  };
  const sev = sevStyles[item.severity] || sevStyles.Minor;
  const stat = statusStyles[item.status] || statusStyles.New;
  const nextStatus = { New: 'Triaged', Triaged: 'In Progress', 'In Progress': 'Fixed', Fixed: 'New', "Won't Fix": 'New' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: typeColors[item.type] || '#73726c' }}>
        {typeIcons[item.type] || 'info'}
      </span>
      <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{item.title}</span>
      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 12, fontWeight: 500, background: sev.bg, color: sev.color }}>{item.severity}</span>
      <button onClick={() => onStatusChange(item, nextStatus[item.status] || 'New')}
        title={`Click to change to ${nextStatus[item.status]}`}
        style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 12, background: stat.bg, color: stat.color, border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-body)' }}
      >{item.status}</button>
    </div>
  );
}

/* ─── Collapsible Section ─── */

function Section({ icon, title, children, defaultOpen = true, right }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? '16px' : 0, cursor: 'pointer' }}
        onClick={() => setOpen(!open)}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>{icon}</span>
        <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text)', flex: 1 }}>{title}</h3>
        {right && <div onClick={e => e.stopPropagation()}>{right}</div>}
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-subtle)', transition: 'transform 0.2s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>expand_more</span>
      </div>
      {open && children}
    </div>
  );
}

/* ─── Main Component ─── */

export default function CommandCentre() {
  const [tasks, setTasks] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const cosmeticAI = staticProjects.find(p => p.id === 'cosmetic-ai');
  const daysToLaunch = getDaysUntil(cosmeticAI?.launchDate);

  // Firestore listeners
  useEffect(() => {
    try {
      const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(30));
      return onSnapshot(q, snap => { setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setFirestoreReady(true); }, () => setFirestoreReady(false));
    } catch { setFirestoreReady(false); }
  }, []);

  useEffect(() => {
    try {
      const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(20));
      return onSnapshot(q, snap => setFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const q = query(collection(db, 'timeline'), orderBy('date', 'desc'), limit(20));
      return onSnapshot(q, snap => setTimeline(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    } catch {}
  }, []);

  // Fallback data
  const displayTasks = tasks.length > 0 ? tasks : [
    { id: '1', title: 'Fix PDF export breaking on multi-page formulas', type: 'Bug', priority: 'critical', status: 'todo' },
    { id: '2', title: 'Test pipeline v2 end-to-end with full dataset', type: 'Test', priority: 'critical', status: 'in-progress' },
    { id: '3', title: 'Make ingredient search mobile responsive', type: 'Polish', priority: 'high', status: 'todo' },
    { id: '4', title: 'Add in-app feedback button with screenshots', type: 'Feature', priority: 'high', status: 'todo' },
    { id: '5', title: 'Implement formulation save/load from Firestore', type: 'Feature', priority: 'medium', status: 'todo' },
    { id: '6', title: 'Run pipeline enrichment on remaining 500 products', type: 'Pipeline', priority: 'medium', status: 'todo' },
  ];

  const staticTimeline = staticProjects
    .flatMap(p => (p.recentCommits || []).map(c => ({
      date: c.date, text: c.message, projectName: p.name, projectId: p.id,
      color: PROJECT_COLORS[p.id] || '#bcd1ca',
      category: parseCommitCategory(c.message),
    })))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const displayTimeline = timeline.length > 0 ? timeline : staticTimeline;

  // Filter timeline
  const filteredTimeline = displayTimeline
    .filter(item => timelineFilter === 'All' || item.projectName === timelineFilter || item.projectId === timelineFilter)
    .filter(item => categoryFilter === 'All' || item.category === categoryFilter)
    .slice(0, 8);

  const projectNames = ['All', ...staticProjects.map(p => p.name)];
  const categories = ['All', ...new Set(displayTimeline.map(i => i.category).filter(Boolean))];

  const openTasks = displayTasks.filter(t => t.status !== 'done').length;
  const openBugs = feedback.filter(f => f.type === 'Bug' && f.status !== 'Fixed').length || displayTasks.filter(t => t.type === 'Bug' && t.status !== 'done').length;

  // Actions
  const handleTaskToggle = async (task) => {
    const nextIdx = (TASK_STATUSES.indexOf(task.status) + 1) % TASK_STATUSES.length;
    const newStatus = TASK_STATUSES[nextIdx];
    if (firestoreReady && task.id && !task.id.match(/^\d$/)) {
      await updateDoc(doc(db, 'tasks', task.id), { status: newStatus });
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    }
  };

  const handleAddTask = async (data) => {
    if (firestoreReady) {
      await addDoc(collection(db, 'tasks'), { ...data, createdAt: serverTimestamp() });
    } else {
      setTasks(prev => [{ id: String(Date.now()), ...data }, ...prev]);
    }
  };

  const handleFeedbackSubmit = async (data) => {
    if (firestoreReady) {
      await addDoc(collection(db, 'feedback'), { ...data, status: 'New', createdAt: serverTimestamp() });
    } else {
      setFeedback(prev => [{ id: String(Date.now()), ...data, status: 'New' }, ...prev]);
    }
  };

  const handleFeedbackStatusChange = async (item, newStatus) => {
    if (firestoreReady && item.id) {
      await updateDoc(doc(db, 'feedback', item.id), { status: newStatus });
    } else {
      setFeedback(prev => prev.map(f => f.id === item.id ? { ...f, status: newStatus } : f));
    }
  };

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ marginBottom: '4px', fontSize: '1.75rem', color: 'var(--text)' }}>{getGreeting()}, Soma</h1>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
          {cosmeticAI && `Last session: ${cosmeticAI.lastCommit} (${formatRelativeDate(cosmeticAI.lastWorked)})`}
        </p>
        {!firestoreReady && (
          <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
            Using static data — Firestore will go live once seeded
          </p>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: 'var(--space-xl)' }}>
        <StatCard icon="timer" label="Days to Launch" value={daysToLaunch} sub="May 15, 2026" color="#d97757" />
        <StatCard icon="task_alt" label="Open Tasks" value={openTasks} sub={`${displayTasks.filter(t => t.status === 'in-progress').length} in progress`} color="#6a9bcc" />
        <StatCard icon="trending_up" label="Progress" value={`${cosmeticAI?.progress || 0}%`} sub="Across milestones" color="#788c5d" />
        <StatCard icon="bug_report" label="Open Issues" value={openBugs || 3} sub="1 critical" color="#c46686" />
      </div>

      {/* Milestones — horizontal bars */}
      <Section icon="flag" title="Launch Milestones — Cosmetic AI">
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '24px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ProgressBar label="Core Features" percent={cosmeticAI?.milestones?.coreFeatures || 0} color="#6a9bcc" />
            <ProgressBar label="Pipeline Stable" percent={cosmeticAI?.milestones?.pipeline || 0} color="#788c5d" />
            <ProgressBar label="Deploy Ready" percent={cosmeticAI?.milestones?.deploy || 0} color="#d97757" />
            <ProgressBar label="UI Polish" percent={cosmeticAI?.milestones?.uiPolish || 0} color="#c46686" />
          </div>
        </div>
      </Section>

      {/* Timeline + Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: 'var(--space-xl)' }}>
        {/* Timeline */}
        <Section icon="history" title="Activity Timeline">
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px', border: '1px solid var(--border)' }}>
            <FilterChips options={projectNames} selected={timelineFilter} onChange={setTimelineFilter}
              colorMap={{ 'Cosmetic AI Assistant': '#d97757', 'Anaconda Learning Hub': '#6a9bcc', 'Colorist': '#788c5d', 'Pattern Visualization': '#bcd1ca' }} />
            {categories.length > 2 && (
              <FilterChips options={categories} selected={categoryFilter} onChange={setCategoryFilter}
                colorMap={Object.fromEntries(Object.entries(CATEGORY_STYLES).map(([k, v]) => [k, v.color]))} />
            )}
            {filteredTimeline.map((item, i) => (
              <TimelineItem key={i} dot={item.color} date={item.date} text={item.text || item.message} project={item.projectName} category={item.category} />
            ))}
            {filteredTimeline.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-subtle)', padding: '20px 0', textAlign: 'center' }}>No activity matching filters</p>
            )}
          </div>
        </Section>

        {/* Tasks */}
        <Section icon="checklist" title="Priority Tasks">
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px', border: '1px solid var(--border)' }}>
            {displayTasks.filter(t => t.status !== 'done').map(t => (
              <TaskItem key={t.id} task={t} onToggle={handleTaskToggle} />
            ))}
            {displayTasks.filter(t => t.status === 'done').length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: '12px', color: 'var(--text-subtle)', cursor: 'pointer', padding: '4px 0' }}>
                  {displayTasks.filter(t => t.status === 'done').length} completed
                </summary>
                {displayTasks.filter(t => t.status === 'done').map(t => (
                  <TaskItem key={t.id} task={t} onToggle={handleTaskToggle} />
                ))}
              </details>
            )}
            <AddTaskForm onSubmit={handleAddTask} />
          </div>
        </Section>
      </div>

      {/* Feedback */}
      <Section icon="rate_review" title="Feedback & Issues">
        <FeedbackForm onSubmit={handleFeedbackSubmit} />
        {feedback.length > 0 && (
          <div style={{ marginTop: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {feedback.map(f => <FeedbackItem key={f.id} item={f} onStatusChange={handleFeedbackStatusChange} />)}
          </div>
        )}
      </Section>

      {/* Projects */}
      <Section icon="folder_open" title="Projects">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {staticProjects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      </Section>
    </div>
  );
}
