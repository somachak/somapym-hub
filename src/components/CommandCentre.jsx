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

function parseCommitCategory(message) {
  const match = message.match(/^(data|docs|feat|fix|test|chore|refactor|style|perf)[\s:(!]/i);
  return match ? match[1].toLowerCase() : null;
}

const CAT_STYLES = {
  data: { bg: '#dfeee8', color: '#788c5d' }, docs: { bg: '#f0eef8', color: '#4b3aa6' },
  feat: { bg: '#dce8f4', color: '#6a9bcc' }, fix: { bg: '#fde8e8', color: '#8d2525' },
  test: { bg: '#fce8f0', color: '#c46686' }, chore: { bg: '#f5f4ed', color: '#73726c' },
  refactor: { bg: '#ebdbbc', color: '#754600' }, perf: { bg: '#c8ddd4', color: '#325c00' },
};

const PROJECT_COLORS = { 'cosmetic-ai': '#d97757', 'anaconda-hub': '#6a9bcc', 'colorist': '#788c5d', 'pattern-viz': '#bcd1ca' };

const TASK_STATUSES = ['todo', 'in-progress', 'done'];

/* ─── Smart Recommendations Engine ─── */

function generateRecommendations(projects) {
  const recs = [];
  const cosmeticAI = projects.find(p => p.id === 'cosmetic-ai');
  const daysToLaunch = getDaysUntil(cosmeticAI?.launchDate);

  // Launch pressure
  if (daysToLaunch !== null && daysToLaunch < 40) {
    const weakest = Object.entries(cosmeticAI?.milestones || {})
      .map(([k, v]) => ({ name: k.replace(/([A-Z])/g, ' $1').trim(), pct: v }))
      .sort((a, b) => a.pct - b.pct)[0];
    if (weakest && weakest.pct < 70) {
      recs.push({
        icon: 'priority_high', color: '#d97757',
        text: `${daysToLaunch} days to launch — "${weakest.name}" is only ${weakest.pct}%. Focus here this week.`,
        action: 'Review milestones',
      });
    }
  }

  // Stale projects
  projects.filter(p => p.status === 'Active').forEach(p => {
    const days = getDaysSince(p.lastWorked);
    if (days > 14) {
      recs.push({
        icon: 'schedule', color: '#a86b00',
        text: `${p.name} — untouched for ${days} days. ${p.priority === 'P1' ? 'This is P1!' : 'Consider archiving or scheduling a session.'}`,
        action: p.nextAction || 'Review project',
      });
    }
  });

  // Critical tasks
  const allTasks = projects.flatMap(p => (p.openTasks || []).filter(t => t.priority === 'critical' && t.status !== 'done'));
  if (allTasks.length > 0) {
    recs.push({
      icon: 'bug_report', color: '#8d2525',
      text: `${allTasks.length} critical task${allTasks.length > 1 ? 's' : ''} need attention: ${allTasks[0].title}`,
      action: allTasks[0].context || 'Fix this first',
    });
  }

  // Pipeline specific
  if (cosmeticAI?.milestones?.pipeline >= 80 && cosmeticAI?.milestones?.pipeline < 100) {
    const daysSinceTouch = getDaysSince(cosmeticAI.lastWorked);
    if (daysSinceTouch > 7) {
      recs.push({
        icon: 'sync', color: '#788c5d',
        text: `Pipeline is ${cosmeticAI.milestones.pipeline}% done but untouched for ${daysSinceTouch} days. Run the enrichment batch to close the gap.`,
        action: 'Run: python scripts/pipeline/pubchem_enrichment.py',
      });
    }
  }

  return recs;
}

function pickTodaysFocus(projects) {
  const cosmeticAI = projects.find(p => p.id === 'cosmetic-ai');
  if (!cosmeticAI) return null;

  // Find the highest-priority unfinished task
  const criticalTasks = (cosmeticAI.openTasks || []).filter(t => t.priority === 'critical' && t.status !== 'done');
  if (criticalTasks.length > 0) {
    return { task: criticalTasks[0], project: cosmeticAI };
  }

  const highTasks = (cosmeticAI.openTasks || []).filter(t => t.priority === 'high' && t.status !== 'done');
  if (highTasks.length > 0) {
    return { task: highTasks[0], project: cosmeticAI };
  }

  // Fall back to the project's next action
  return { task: { title: cosmeticAI.nextAction, context: 'Check the project page for details', type: 'Feature', priority: 'high' }, project: cosmeticAI };
}

/* ─── Sub-components ─── */

function TodaysFocus({ focus }) {
  if (!focus) return null;
  const { task, project } = focus;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #faf9f5 0%, #dfeee8 50%, #dce8f4 100%)',
      borderRadius: 16, padding: '28px 32px', marginBottom: 'var(--space-xl)',
      border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#d97757',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{ color: 'white', fontSize: 24 }}>target</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: '#73726c', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: 6 }}>
            Today's Focus
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 600, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>
            {task.title}
          </div>
          {task.context && (
            <div style={{ fontSize: '13px', color: '#5e5d59', lineHeight: 1.5, marginBottom: 12 }}>
              {task.context}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '11px', color: '#73726c', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder</span>
              {project.name}
            </span>
            {task.type && (
              <span style={{
                fontSize: '10px', padding: '3px 8px', borderRadius: 10, fontWeight: 600,
                background: CAT_STYLES[task.type.toLowerCase()]?.bg || '#dce8f4',
                color: CAT_STYLES[task.type.toLowerCase()]?.color || '#6a9bcc',
              }}>{task.type}</span>
            )}
            {task.priority && (
              <span style={{
                fontSize: '10px', padding: '3px 8px', borderRadius: 10, fontWeight: 600,
                background: task.priority === 'critical' ? '#fde8e8' : '#fff3e0',
                color: task.priority === 'critical' ? '#8d2525' : '#a86b00',
              }}>{task.priority}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Recommendations({ recs }) {
  if (recs.length === 0) return null;
  return (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#a86b00' }}>lightbulb</span>
        <h3 style={{ fontSize: '0.875rem', margin: 0, color: 'var(--text)', fontWeight: 600 }}>Recommendations</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recs.map((rec, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
            background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: rec.color, marginTop: 1 }}>{rec.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.4 }}>{rec.text}</div>
              {rec.action && (
                <div style={{ fontSize: '11px', color: '#73726c', marginTop: 4, fontFamily: 'var(--font-body)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }}>arrow_forward</span>
                  {rec.action}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, items, expanded, onToggle }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px',
      border: '1px solid var(--border)', cursor: items ? 'pointer' : 'default',
      transition: 'box-shadow 0.15s',
    }}
      onClick={items ? onToggle : undefined}
      onMouseEnter={items ? e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(20,20,19,0.08)' : undefined}
      onMouseLeave={items ? e => e.currentTarget.style.boxShadow = 'none' : undefined}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-subtle)' }}>{icon}</span>
        {label}
        {items && <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 'auto', color: 'var(--text-subtle)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>expand_more</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
      {expanded && items && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {items.map((item, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ percent, color, label }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color }}>{percent}%</span>
      </div>
      <div style={{ width: '100%', height: 8, background: '#e8e6dc', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${percent}%`, background: color, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

function CategoryChip({ category }) {
  const s = CAT_STYLES[category];
  if (!s) return null;
  return <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: 10, fontWeight: 600, background: s.bg, color: s.color }}>{category}</span>;
}

function TimelineItem({ dot, date, text, project, category }) {
  const daysAgo = getDaysSince(date);
  const relDate = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : daysAgo < 7 ? `${daysAgo}d ago` : date;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{relDate}</span>
          {category && <CategoryChip category={category} />}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
        <span style={{ fontSize: '11px', color: 'var(--text-subtle)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>{project}</span>
      </div>
    </div>
  );
}

function FilterChips({ options, selected, onChange, colorMap }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(selected === opt ? 'All' : opt)} style={{
          fontSize: '11px', padding: '4px 10px', borderRadius: 14, border: '1px solid var(--border)',
          background: selected === opt ? (colorMap?.[opt] || 'var(--text)') : 'transparent',
          color: selected === opt ? '#fff' : 'var(--text-muted)',
          cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, transition: 'all 0.15s',
        }}>{opt}</button>
      ))}
    </div>
  );
}

function TaskItem({ task, onToggle }) {
  const priorityColors = { critical: '#d97757', high: '#6a9bcc', medium: '#bcd1ca' };
  const tagStyles = { Bug: { bg: '#fde8e8', color: '#8d2525' }, Feature: { bg: '#dce8f4', color: '#6a9bcc' }, Test: { bg: '#f0eef8', color: '#4b3aa6' }, Polish: { bg: '#fce8f0', color: '#c46686' }, Pipeline: { bg: '#dfeee8', color: '#788c5d' } };
  const tag = tagStyles[task.type] || tagStyles.Feature;
  const isDone = task.status === 'done';
  const statusIcon = isDone ? 'check_circle' : task.status === 'in-progress' ? 'pending' : 'radio_button_unchecked';
  const statusColor = isDone ? '#788c5d' : task.status === 'in-progress' ? '#6a9bcc' : '#d1cfc5';
  const [showContext, setShowContext] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, transition: 'background 0.15s', opacity: isDone ? 0.5 : 1 }}
        onMouseEnter={e => e.currentTarget.style.background = '#f5f4ed'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <button onClick={() => onToggle(task)} title="Click to change status" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: statusColor }}>{statusIcon}</span>
        </button>
        <div style={{ width: 4, height: 24, borderRadius: 2, background: priorityColors[task.priority], flexShrink: 0 }} />
        <span onClick={() => task.context && setShowContext(!showContext)} style={{
          fontSize: '13px', color: 'var(--text)', flex: 1, cursor: task.context ? 'pointer' : 'default',
          textDecoration: isDone ? 'line-through' : 'none',
        }}>{task.title}</span>
        {task.context && (
          <span className="material-symbols-outlined" onClick={() => setShowContext(!showContext)}
            style={{ fontSize: 16, color: 'var(--text-subtle)', cursor: 'pointer' }}
          >{showContext ? 'expand_less' : 'info'}</span>
        )}
        <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 12, fontWeight: 500, background: tag.bg, color: tag.color }}>{task.type}</span>
      </div>
      {showContext && task.context && (
        <div style={{
          fontSize: '12px', color: '#5e5d59', padding: '6px 12px 10px 52px',
          background: '#faf9f5', borderRadius: '0 0 8px 8px', lineHeight: 1.5,
          borderLeft: `3px solid ${priorityColors[task.priority]}`, marginLeft: 12,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }}>arrow_forward</span>
          {task.context}
        </div>
      )}
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
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)',
        fontSize: '12px', fontFamily: 'var(--font-body)',
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

  const selectStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', fontSize: '12px', fontFamily: 'var(--font-body)', color: 'var(--text)', outline: 'none' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0' }}>
      <input placeholder="What needs doing?" value={title} onChange={e => setTitle(e.target.value)} autoFocus style={{ ...selectStyle, flex: 1 }} />
      <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
        {['Feature', 'Bug', 'Test', 'Polish', 'Pipeline'].map(t => <option key={t}>{t}</option>)}
      </select>
      <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
        {['critical', 'high', 'medium'].map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="submit" disabled={submitting || !title.trim()} style={{
        padding: '6px 14px', borderRadius: 6, background: '#d97757', border: 'none',
        color: 'white', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)',
        opacity: submitting || !title.trim() ? 0.5 : 1,
      }}>{submitting ? '...' : 'Add'}</button>
      <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 0 }}>
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
  const taskCount = (project.openTasks || []).filter(t => t.status !== 'done').length;

  return (
    <Link to={`/app/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: '18px',
        border: '1px solid var(--border)', transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(20,20,19,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{project.name}</div>
          <span style={{ fontSize: '10px', fontWeight: 600, color: project.priority === 'P1' ? '#d97757' : '#9c9a92' }}>{project.priority}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)', marginBottom: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {statusText}
          {taskCount > 0 && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#6a9bcc' }}>{taskCount} tasks</span>}
        </div>
        <div style={{ width: '100%', height: 4, background: '#e8e6dc', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', borderRadius: 2, width: `${project.progress}%`, background: barColors[idx % barColors.length], transition: 'width 0.6s ease' }} />
        </div>
        {project.nextAction && (
          <div style={{ fontSize: '11px', color: '#5e5d59', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#d97757', marginTop: 2, flexShrink: 0 }}>arrow_forward</span>
            {project.nextAction.length > 60 ? project.nextAction.substring(0, 60) + '...' : project.nextAction}
          </div>
        )}
      </div>
    </Link>
  );
}

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
        cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-body)', width: '100%',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#d97757'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1cfc5'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#d97757' }}>add_circle</span>
        Log a bug, idea, or issue
      </button>
    );
  }

  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', fontSize: '13px', fontFamily: 'var(--font-body)', color: 'var(--text)', outline: 'none', width: '100%' };
  const selectStyle = { ...inputStyle, width: 'auto' };

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px' }}>New Feedback</span>
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
      <textarea placeholder="Steps to reproduce or details (optional)" value={steps} onChange={e => setSteps(e.target.value)} rows={3} style={{ ...inputStyle, marginBottom: 12, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setIsOpen(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
        <button type="submit" disabled={submitting || !title.trim()} style={{ padding: '8px 16px', borderRadius: 8, background: '#d97757', border: 'none', color: 'white', fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', opacity: submitting || !title.trim() ? 0.5 : 1 }}>{submitting ? 'Saving...' : 'Submit'}</button>
      </div>
    </form>
  );
}

function Section({ icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 16 : 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>{icon}</span>
        <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text)', flex: 1 }}>{title}</h3>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-subtle)', transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>expand_more</span>
      </div>
      {open && children}
    </div>
  );
}

/* ─── Main Component ─── */

export default function CommandCentre() {
  const [tasks, setTasks] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedStat, setExpandedStat] = useState(null);

  const cosmeticAI = staticProjects.find(p => p.id === 'cosmetic-ai');
  const daysToLaunch = getDaysUntil(cosmeticAI?.launchDate);

  // Firestore listeners
  useEffect(() => {
    try {
      return onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(30)),
        snap => { setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setFirestoreReady(true); },
        () => setFirestoreReady(false));
    } catch { setFirestoreReady(false); }
  }, []);

  useEffect(() => {
    try {
      return onSnapshot(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(20)),
        snap => setFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    } catch {}
  }, []);

  // All tasks from all projects (static + Firestore)
  const allTasks = tasks.length > 0 ? tasks : staticProjects.flatMap(p => p.openTasks || []);
  const openTasksList = allTasks.filter(t => t.status !== 'done');
  const bugTasks = allTasks.filter(t => t.type === 'Bug' && t.status !== 'done');

  // Timeline from static data
  const displayTimeline = staticProjects
    .flatMap(p => (p.recentCommits || []).map(c => ({
      date: c.date, text: c.message, projectName: p.name, projectId: p.id,
      color: PROJECT_COLORS[p.id] || '#bcd1ca', category: parseCommitCategory(c.message),
    })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter(item => timelineFilter === 'All' || item.projectName === timelineFilter)
    .filter(item => categoryFilter === 'All' || item.category === categoryFilter)
    .slice(0, 8);

  // Proactive data
  const focus = pickTodaysFocus(staticProjects);
  const recs = generateRecommendations(staticProjects);

  // Actions
  const handleTaskToggle = async (task) => {
    const next = TASK_STATUSES[(TASK_STATUSES.indexOf(task.status) + 1) % TASK_STATUSES.length];
    if (firestoreReady && task.id && !task.id.match(/^[ta]\d$/)) {
      await updateDoc(doc(db, 'tasks', task.id), { status: next });
    }
    // Always update local state for immediate feedback
    setTasks(prev => prev.length > 0 ? prev.map(t => t.id === task.id ? { ...t, status: next } : t) : prev);
  };

  const handleAddTask = async (data) => {
    const newTask = { id: `local-${Date.now()}`, ...data, createdAt: new Date().toISOString() };
    if (firestoreReady) {
      await addDoc(collection(db, 'tasks'), { ...data, createdAt: serverTimestamp() });
    }
    setTasks(prev => [newTask, ...prev]);
  };

  const handleFeedbackSubmit = async (data) => {
    const newItem = { id: `fb-${Date.now()}`, ...data, status: 'New', createdAt: new Date().toISOString() };
    if (firestoreReady) {
      await addDoc(collection(db, 'feedback'), { ...data, status: 'New', createdAt: serverTimestamp() });
    }
    setFeedback(prev => [newItem, ...prev]);
  };

  const handleFeedbackStatus = async (item, newStatus) => {
    if (firestoreReady && item.id && !item.id.startsWith('fb-')) {
      await updateDoc(doc(db, 'feedback', item.id), { status: newStatus });
    }
    setFeedback(prev => prev.map(f => f.id === item.id ? { ...f, status: newStatus } : f));
  };

  const projectNames = ['All', ...staticProjects.map(p => p.name)];
  const categories = ['All', ...new Set(displayTimeline.map(i => i.category).filter(Boolean))];

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ marginBottom: '4px', fontSize: '1.75rem', color: 'var(--text)' }}>{getGreeting()}, Soma</h1>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
          {daysToLaunch !== null && `${daysToLaunch} days to Cosmetic AI launch. `}
          {cosmeticAI && `Last active: ${new Date(cosmeticAI.lastWorked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} (${getDaysSince(cosmeticAI.lastWorked)}d ago)`}
        </p>
      </div>

      {/* TODAY'S FOCUS — the one thing to do */}
      <TodaysFocus focus={focus} />

      {/* RECOMMENDATIONS — proactive nudges */}
      <Recommendations recs={recs} />

      {/* Stats — clickable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: 'var(--space-xl)' }}>
        <StatCard icon="timer" label="Days to Launch" value={daysToLaunch} sub="May 15, 2026" color="#d97757" />
        <StatCard icon="task_alt" label="Open Tasks" value={openTasksList.length} sub="Click to see all" color="#6a9bcc"
          items={openTasksList.map(t => `[${t.priority}] ${t.title}`)}
          expanded={expandedStat === 'tasks'} onToggle={() => setExpandedStat(expandedStat === 'tasks' ? null : 'tasks')} />
        <StatCard icon="trending_up" label="Progress" value={`${cosmeticAI?.progress || 0}%`} sub="Across milestones" color="#788c5d"
          items={Object.entries(cosmeticAI?.milestones || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${v}%`)}
          expanded={expandedStat === 'progress'} onToggle={() => setExpandedStat(expandedStat === 'progress' ? null : 'progress')} />
        <StatCard icon="bug_report" label="Open Bugs" value={bugTasks.length || feedback.filter(f => f.type === 'Bug' && f.status !== 'Fixed').length} sub="Click to see all" color="#c46686"
          items={bugTasks.map(t => t.title)}
          expanded={expandedStat === 'bugs'} onToggle={() => setExpandedStat(expandedStat === 'bugs' ? null : 'bugs')} />
      </div>

      {/* Milestones */}
      <Section icon="flag" title="Launch Milestones — Cosmetic AI">
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ProgressBar label="Core Features" percent={cosmeticAI?.milestones?.coreFeatures || 0} color="#6a9bcc" />
            <ProgressBar label="Pipeline Stable" percent={cosmeticAI?.milestones?.pipeline || 0} color="#788c5d" />
            <ProgressBar label="Deploy Ready" percent={cosmeticAI?.milestones?.deploy || 0} color="#d97757" />
            <ProgressBar label="UI Polish" percent={cosmeticAI?.milestones?.uiPolish || 0} color="#c46686" />
          </div>
        </div>
      </Section>

      {/* Timeline + Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 'var(--space-xl)' }}>
        <Section icon="history" title="Activity Timeline">
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
            <FilterChips options={projectNames} selected={timelineFilter} onChange={setTimelineFilter}
              colorMap={{ 'Cosmetic AI Assistant': '#d97757', 'Anaconda Learning Hub': '#6a9bcc', 'Colorist': '#788c5d', 'Pattern Visualization': '#bcd1ca' }} />
            {categories.length > 2 && <FilterChips options={categories} selected={categoryFilter} onChange={setCategoryFilter} colorMap={Object.fromEntries(Object.entries(CAT_STYLES).map(([k, v]) => [k, v.color]))} />}
            {displayTimeline.map((item, i) => (
              <TimelineItem key={i} dot={item.color} date={item.date} text={item.text} project={item.projectName} category={item.category} />
            ))}
            {displayTimeline.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-subtle)', padding: 20, textAlign: 'center' }}>No activity matching filters</p>}
          </div>
        </Section>

        <Section icon="checklist" title="Priority Tasks">
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
            {openTasksList.map(t => <TaskItem key={t.id} task={t} onToggle={handleTaskToggle} />)}
            {allTasks.filter(t => t.status === 'done').length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: '12px', color: 'var(--text-subtle)', cursor: 'pointer', padding: '4px 0' }}>
                  {allTasks.filter(t => t.status === 'done').length} completed
                </summary>
                {allTasks.filter(t => t.status === 'done').map(t => <TaskItem key={t.id} task={t} onToggle={handleTaskToggle} />)}
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
            {feedback.map(f => {
              const typeIcons = { Bug: 'bug_report', 'Feature Request': 'lightbulb', 'UX Issue': 'design_services', Risk: 'warning' };
              const typeColors = { Bug: '#8d2525', 'Feature Request': '#6a9bcc', 'UX Issue': '#c46686', Risk: '#a86b00' };
              const sevBg = { Critical: '#fde8e8', Major: '#fff3e0', Minor: '#f5f4ed', Cosmetic: '#f5f4ed' };
              const sevColor = { Critical: '#8d2525', Major: '#a86b00', Minor: '#73726c', Cosmetic: '#9c9a92' };
              const statBg = { New: '#fde8e8', Triaged: '#fff3e0', 'In Progress': '#dce8f4', Fixed: '#dfeee8' };
              const statColor = { New: '#8d2525', Triaged: '#a86b00', 'In Progress': '#6a9bcc', Fixed: '#788c5d' };
              const nextStatus = { New: 'Triaged', Triaged: 'In Progress', 'In Progress': 'Fixed', Fixed: 'New' };
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: typeColors[f.type] || '#73726c' }}>{typeIcons[f.type] || 'info'}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{f.title}</span>
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 12, fontWeight: 500, background: sevBg[f.severity] || '#f5f4ed', color: sevColor[f.severity] || '#73726c' }}>{f.severity}</span>
                  <button onClick={() => handleFeedbackStatus(f, nextStatus[f.status] || 'New')} title={`Click to change to ${nextStatus[f.status]}`}
                    style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 12, background: statBg[f.status] || '#f5f4ed', color: statColor[f.status] || '#73726c', border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-body)' }}>{f.status}</button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Projects */}
      <Section icon="folder_open" title="Projects">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {staticProjects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      </Section>
    </div>
  );
}
