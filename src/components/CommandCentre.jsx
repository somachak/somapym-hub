import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projects } from '../data/projects';

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
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function getDaysSince(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - target) / (1000 * 60 * 60 * 24));
}

function formatRelativeDate(dateStr) {
  const days = getDaysSince(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function ProgressRing({ percent, color, size = 72, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--surface-high)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontFamily: 'var(--font-heading)', fontWeight: 600,
        fontSize: '16px', color,
      }}>
        {percent}%
      </span>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: 'var(--space-lg)', border: '1px solid var(--border)' }}>
      <div style={{
        fontSize: '12px', color: 'var(--text-subtle)',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-heading)', fontSize: '28px',
        fontWeight: 700, color, marginBottom: '4px',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

function TimelineItem({ dot, date, text, project }) {
  return (
    <div style={{
      display: 'flex', gap: '12px', padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: dot, marginTop: 6, flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginBottom: 2 }}>{date}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{text}</div>
        <span style={{
          fontSize: '11px', color: 'var(--text-subtle)',
          background: 'var(--bg-secondary)', padding: '2px 8px',
          borderRadius: 4, display: 'inline-block', marginTop: 4,
        }}>{project}</span>
      </div>
    </div>
  );
}

function TaskItem({ priority, text, type }) {
  const priorityColors = { critical: 'var(--accent)', high: 'var(--sky)', medium: 'var(--cactus)' };
  const tagStyles = {
    Bug: { bg: '#fde8e8', color: '#8d2525' },
    Feature: { bg: 'var(--pastel-blue-light)', color: 'var(--sky)' },
    Test: { bg: '#f0eef8', color: '#4b3aa6' },
    Polish: { bg: '#fce8f0', color: 'var(--fig)' },
    Pipeline: { bg: 'var(--pastel-green-light)', color: 'var(--olive)' },
  };
  const tag = tagStyles[type] || tagStyles.Feature;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: '8px',
      transition: 'background 0.15s', cursor: 'pointer',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-low)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 4, height: 28, borderRadius: 2,
        background: priorityColors[priority], flexShrink: 0,
      }} />
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{text}</span>
      <span style={{
        fontSize: '10px', padding: '3px 8px', borderRadius: 12,
        fontWeight: 500, background: tag.bg, color: tag.color,
      }}>{type}</span>
    </div>
  );
}

function ProjectCard({ project }) {
  const daysSince = getDaysSince(project.lastWorked);
  const isStale = daysSince > 7;
  const statusColor = project.status === 'On Hold' ? 'var(--text-subtle)' : isStale ? 'var(--accent)' : 'var(--olive)';
  const statusText = project.status === 'On Hold' ? 'On Hold' :
    isStale ? `${daysSince} days stale` : 'Active';
  const barColors = ['var(--olive)', 'var(--sky)', 'var(--cactus)', 'var(--text-subtle)'];
  const idx = projects.indexOf(project);

  return (
    <Link to={`/app/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{
        padding: '18px', border: '1px solid var(--border)',
        transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'pointer',
      }}>
        <div style={{
          fontFamily: 'var(--font-heading)', fontWeight: 600,
          fontSize: '13px', color: 'var(--text)', marginBottom: 6,
        }}>{project.name}</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '11px', color: 'var(--text-muted)', marginBottom: 10,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: statusColor,
          }} />
          {statusText}
          {project.priority && <span style={{
            marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
            color: project.priority === 'P1' ? 'var(--accent)' : 'var(--text-subtle)',
          }}>{project.priority}</span>}
        </div>
        <div style={{
          width: '100%', height: 4, background: 'var(--surface-high)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${project.progress}%`,
            background: barColors[idx % barColors.length],
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>
    </Link>
  );
}

export default function CommandCentre() {
  const cosmeticAI = projects.find(p => p.id === 'cosmetic-ai');
  const daysToLaunch = getDaysUntil(cosmeticAI?.launchDate);

  const openTasks = 12;
  const openBugs = 3;

  // Build timeline from all projects' recent commits
  const timeline = projects
    .flatMap(p => (p.recentCommits || []).map(c => ({
      ...c, projectName: p.name, color: p.id === 'cosmetic-ai' ? 'var(--accent)' :
        p.id === 'anaconda-hub' ? 'var(--sky)' :
        p.id === 'colorist' ? 'var(--olive)' : 'var(--cactus)',
    })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ marginBottom: '4px', fontSize: '1.75rem' }}>
          {getGreeting()}, Soma
        </h1>
        <p style={{
          fontFamily: 'var(--font-serif)', fontSize: '15px',
          color: 'var(--text-muted)', fontStyle: 'italic', margin: 0,
        }}>
          {cosmeticAI && `Last session: ${cosmeticAI.lastCommit} (${formatRelativeDate(cosmeticAI.lastWorked)})`}
        </p>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px', marginBottom: 'var(--space-xl)',
      }}>
        <StatCard icon="timer" label="Days to Launch" value={daysToLaunch} sub="May 15, 2026" color="var(--accent)" />
        <StatCard icon="task_alt" label="Open Tasks" value={openTasks} sub="4 in progress, 2 blocked" color="var(--sky)" />
        <StatCard icon="trending_up" label="Overall Progress" value={`${cosmeticAI?.progress || 0}%`} sub="Across all milestones" color="var(--olive)" />
        <StatCard icon="bug_report" label="Open Bugs" value={openBugs} sub="1 critical" color="var(--fig)" />
      </div>

      {/* Milestone Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '16px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>flag</span>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>Launch Milestones — Cosmetic AI</h3>
      </div>
      <div className="card" style={{
        padding: 'var(--space-xl)', border: '1px solid var(--border)',
        marginBottom: 'var(--space-xl)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px', textAlign: 'center',
        }}>
          {cosmeticAI?.milestones && [
            { name: 'Core Features', pct: cosmeticAI.milestones.coreFeatures, color: 'var(--sky)' },
            { name: 'Pipeline Stable', pct: cosmeticAI.milestones.pipeline, color: 'var(--olive)' },
            { name: 'Deploy Ready', pct: cosmeticAI.milestones.deploy, color: 'var(--accent)' },
            { name: 'UI Polish', pct: cosmeticAI.milestones.uiPolish, color: 'var(--fig)' },
          ].map(m => (
            <div key={m.name}>
              <div style={{
                fontSize: '13px', fontWeight: 500,
                color: 'var(--text-secondary)', marginBottom: 10,
              }}>{m.name}</div>
              <ProgressRing percent={m.pct} color={m.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline + Tasks */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '20px', marginBottom: 'var(--space-xl)',
      }}>
        {/* Timeline */}
        <div className="card" style={{ padding: 'var(--space-xl)', border: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 600,
            fontSize: '14px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>history</span>
            Activity Timeline
          </div>
          {timeline.map((item, i) => (
            <TimelineItem
              key={i}
              dot={item.color}
              date={item.date}
              text={item.message}
              project={item.projectName}
            />
          ))}
        </div>

        {/* Priority Tasks */}
        <div className="card" style={{ padding: 'var(--space-xl)', border: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 600,
            fontSize: '14px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>checklist</span>
            Priority Tasks
          </div>
          <TaskItem priority="critical" text="Fix PDF export breaking on multi-page formulas" type="Bug" />
          <TaskItem priority="critical" text="Test pipeline v2 end-to-end with full dataset" type="Test" />
          <TaskItem priority="high" text="Make ingredient search mobile responsive" type="Polish" />
          <TaskItem priority="high" text="Add in-app feedback button with screenshots" type="Feature" />
          <TaskItem priority="medium" text="Implement formulation save/load from Firestore" type="Feature" />
          <TaskItem priority="medium" text="Run pipeline enrichment on remaining 500 products" type="Pipeline" />
        </div>
      </div>

      {/* Projects */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '16px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>folder_open</span>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>Projects</h3>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px',
      }}>
        {projects.map(p => <ProjectCard key={p.id} project={p} />)}
      </div>
    </div>
  );
}
