import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { projects as staticProjects } from '../data/projects';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
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

/* ─── Sub-components ─── */

function ProgressRing({ percent, color, size = 72, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e8e6dc" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '16px', color,
      }}>{percent}%</span>
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

function TimelineItem({ dot, date, text, project }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 6, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginBottom: 2 }}>{date}</div>
        <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
        <span style={{
          fontSize: '11px', color: 'var(--text-subtle)', background: 'var(--bg-secondary)',
          padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4,
        }}>{project}</span>
      </div>
    </div>
  );
}

function TaskItem({ priority, text, type, status, onToggle }) {
  const priorityColors = { critical: '#d97757', high: '#6a9bcc', medium: '#bcd1ca' };
  const tagStyles = {
    Bug: { bg: '#fde8e8', color: '#8d2525' },
    Feature: { bg: '#dce8f4', color: '#6a9bcc' },
    Test: { bg: '#f0eef8', color: '#4b3aa6' },
    Polish: { bg: '#fce8f0', color: '#c46686' },
    Pipeline: { bg: '#dfeee8', color: '#788c5d' },
  };
  const tag = tagStyles[type] || tagStyles.Feature;
  const isDone = status === 'done';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: '8px', transition: 'background 0.15s', cursor: 'pointer',
      opacity: isDone ? 0.5 : 1,
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#f5f4ed'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 4, height: 28, borderRadius: 2, background: priorityColors[priority], flexShrink: 0 }} />
      <span style={{
        fontSize: '13px', color: 'var(--text)', flex: 1,
        textDecoration: isDone ? 'line-through' : 'none',
      }}>{text}</span>
      <span style={{
        fontSize: '10px', padding: '3px 8px', borderRadius: 12, fontWeight: 500,
        background: tag.bg, color: tag.color,
      }}>{type}</span>
    </div>
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
    background: 'var(--bg-secondary)', fontSize: '13px', fontFamily: 'var(--font-body)',
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
        <button type="button" onClick={() => setIsOpen(false)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <input placeholder="What did you notice?" value={title} onChange={e => setTitle(e.target.value)}
        style={{ ...inputStyle, marginBottom: 12 }} autoFocus />
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
      <textarea placeholder="Steps to reproduce or additional details (optional)" value={steps}
        onChange={e => setSteps(e.target.value)} rows={3}
        style={{ ...inputStyle, marginBottom: 12, resize: 'vertical' }} />
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

/* ─── Main Component ─── */

export default function CommandCentre() {
  const [tasks, setTasks] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [firestoreReady, setFirestoreReady] = useState(false);

  const cosmeticAI = staticProjects.find(p => p.id === 'cosmetic-ai');
  const daysToLaunch = getDaysUntil(cosmeticAI?.launchDate);

  // Listen to Firestore tasks
  useEffect(() => {
    try {
      const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(20));
      const unsub = onSnapshot(q, (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setFirestoreReady(true);
      }, () => setFirestoreReady(false));
      return unsub;
    } catch { setFirestoreReady(false); }
  }, []);

  // Listen to Firestore feedback
  useEffect(() => {
    try {
      const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(10));
      const unsub = onSnapshot(q, (snap) => {
        setFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => {});
      return unsub;
    } catch {}
  }, []);

  // Listen to Firestore timeline
  useEffect(() => {
    try {
      const q = query(collection(db, 'timeline'), orderBy('date', 'desc'), limit(8));
      const unsub = onSnapshot(q, (snap) => {
        setTimeline(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => {});
      return unsub;
    } catch {}
  }, []);

  // Fallback to static data when Firestore has no data
  const displayTasks = tasks.length > 0 ? tasks : [
    { id: '1', title: 'Fix PDF export breaking on multi-page formulas', type: 'Bug', priority: 'critical', status: 'todo' },
    { id: '2', title: 'Test pipeline v2 end-to-end with full dataset', type: 'Test', priority: 'critical', status: 'todo' },
    { id: '3', title: 'Make ingredient search mobile responsive', type: 'Polish', priority: 'high', status: 'todo' },
    { id: '4', title: 'Add in-app feedback button with screenshots', type: 'Feature', priority: 'high', status: 'todo' },
    { id: '5', title: 'Implement formulation save/load from Firestore', type: 'Feature', priority: 'medium', status: 'todo' },
    { id: '6', title: 'Run pipeline enrichment on remaining 500 products', type: 'Pipeline', priority: 'medium', status: 'todo' },
  ];

  const displayTimeline = timeline.length > 0 ? timeline : staticProjects
    .flatMap(p => (p.recentCommits || []).map(c => ({
      date: c.date, text: c.message, projectName: p.name,
      color: p.id === 'cosmetic-ai' ? '#d97757' : p.id === 'anaconda-hub' ? '#6a9bcc' : p.id === 'colorist' ? '#788c5d' : '#bcd1ca',
    })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const openTasks = displayTasks.filter(t => t.status !== 'done').length;
  const openBugs = (feedback.length > 0 ? feedback : []).filter(f => f.type === 'Bug' && f.status !== 'Fixed').length
    || displayTasks.filter(t => t.type === 'Bug' && t.status !== 'done').length;

  const handleFeedbackSubmit = async (data) => {
    await addDoc(collection(db, 'feedback'), {
      ...data,
      status: 'New',
      createdAt: serverTimestamp(),
    });
  };

  const sectionHeader = (icon, title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '16px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>{icon}</span>
      <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text)' }}>{title}</h3>
    </div>
  );

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ marginBottom: '4px', fontSize: '1.75rem', color: 'var(--text)' }}>
          {getGreeting()}, Soma
        </h1>
        <p style={{
          fontFamily: 'var(--font-serif)', fontSize: '15px',
          color: 'var(--text-muted)', fontStyle: 'italic', margin: 0,
        }}>
          {cosmeticAI && `Last session: ${cosmeticAI.lastCommit} (${formatRelativeDate(cosmeticAI.lastWorked)})`}
        </p>
        {!firestoreReady && (
          <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>info</span>
            Showing static data — Firestore not connected yet. Tasks and feedback will be live once seeded.
          </p>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: 'var(--space-xl)' }}>
        <StatCard icon="timer" label="Days to Launch" value={daysToLaunch} sub="May 15, 2026" color="#d97757" />
        <StatCard icon="task_alt" label="Open Tasks" value={openTasks} sub={`${displayTasks.filter(t => t.status === 'in-progress').length || 4} in progress`} color="#6a9bcc" />
        <StatCard icon="trending_up" label="Overall Progress" value={`${cosmeticAI?.progress || 0}%`} sub="Across all milestones" color="#788c5d" />
        <StatCard icon="bug_report" label="Open Issues" value={openBugs || feedback.length || 3} sub={feedback.filter(f => f.severity === 'Critical').length ? `${feedback.filter(f => f.severity === 'Critical').length} critical` : '1 critical'} color="#c46686" />
      </div>

      {/* Milestone Progress */}
      {sectionHeader('flag', 'Launch Milestones — Cosmetic AI')}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: 'var(--space-xl)',
        border: '1px solid var(--border)', marginBottom: 'var(--space-xl)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', textAlign: 'center' }}>
          {[
            { name: 'Core Features', pct: cosmeticAI?.milestones?.coreFeatures || 0, color: '#6a9bcc' },
            { name: 'Pipeline Stable', pct: cosmeticAI?.milestones?.pipeline || 0, color: '#788c5d' },
            { name: 'Deploy Ready', pct: cosmeticAI?.milestones?.deploy || 0, color: '#d97757' },
            { name: 'UI Polish', pct: cosmeticAI?.milestones?.uiPolish || 0, color: '#c46686' },
          ].map(m => (
            <div key={m.name}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>{m.name}</div>
              <ProgressRing percent={m.pct} color={m.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline + Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: 'var(--space-xl)' }}>
        {/* Timeline */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 'var(--space-xl)', border: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px',
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>history</span>
            Activity Timeline
            {!firestoreReady && <span style={{ fontSize: '10px', color: 'var(--text-subtle)', fontWeight: 400, marginLeft: 'auto' }}>from git</span>}
          </div>
          {displayTimeline.map((item, i) => (
            <TimelineItem key={i} dot={item.color} date={item.date} text={item.text || item.message} project={item.projectName} />
          ))}
        </div>

        {/* Priority Tasks */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 'var(--space-xl)', border: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px',
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>checklist</span>
            Priority Tasks
            {!firestoreReady && <span style={{ fontSize: '10px', color: 'var(--text-subtle)', fontWeight: 400, marginLeft: 'auto' }}>placeholder</span>}
          </div>
          {displayTasks.filter(t => t.status !== 'done').map(t => (
            <TaskItem key={t.id} priority={t.priority} text={t.title} type={t.type} status={t.status} />
          ))}
        </div>
      </div>

      {/* Feedback & Issues */}
      {sectionHeader('rate_review', 'Feedback & Issues')}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <FeedbackForm onSubmit={handleFeedbackSubmit} />
        {feedback.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {feedback.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
              }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: 16,
                  color: f.type === 'Bug' ? '#8d2525' : f.type === 'UX Issue' ? '#c46686' : '#6a9bcc',
                }}>{f.type === 'Bug' ? 'bug_report' : f.type === 'UX Issue' ? 'design_services' : 'lightbulb'}</span>
                <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{f.title}</span>
                <span style={{
                  fontSize: '10px', padding: '3px 8px', borderRadius: 12, fontWeight: 500,
                  background: f.severity === 'Critical' ? '#fde8e8' : f.severity === 'Major' ? '#fff3e0' : '#f5f4ed',
                  color: f.severity === 'Critical' ? '#8d2525' : f.severity === 'Major' ? '#a86b00' : '#73726c',
                }}>{f.severity}</span>
                <span style={{
                  fontSize: '10px', padding: '3px 8px', borderRadius: 12,
                  background: f.status === 'New' ? '#fde8e8' : f.status === 'Fixed' ? '#dfeee8' : '#f5f4ed',
                  color: f.status === 'New' ? '#8d2525' : f.status === 'Fixed' ? '#788c5d' : '#73726c',
                }}>{f.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects */}
      {sectionHeader('folder_open', 'Projects')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {staticProjects.map(p => <ProjectCard key={p.id} project={p} />)}
      </div>
    </div>
  );
}
