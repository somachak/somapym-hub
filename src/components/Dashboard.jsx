import { Link } from 'react-router-dom';
import { projects } from '../data/projects';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function ProjectCard({ project }) {
  return (
    <Link
      to={`/app/${project.slug}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        className="card"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-lg">
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{project.name}</h3>
          <span
            className={`badge ${project.status === 'In Progress' ? 'badge-primary' : 'badge-secondary'}`}
          >
            {project.status}
          </span>
        </div>

        {/* Description */}
        <p className="text-muted" style={{ flex: 1, marginBottom: 'var(--space-lg)' }}>
          {project.description}
        </p>

        {/* Tech Stack */}
        <div className="flex" style={{ flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          {project.techStack.map((tech, idx) => (
            <span key={idx} className="tag">
              {tech}
            </span>
          ))}
        </div>

        {/* Footer - Last Activity */}
        <div style={{ borderTop: `1px solid var(--border)`, paddingTop: 'var(--space-lg)' }}>
          <p className="text-muted" style={{ fontSize: '0.8125rem', margin: '0 0 var(--space-xs) 0' }}>
            Last commit
          </p>
          <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', color: 'var(--text)' }}>
            {project.lastCommit}
          </p>
          <p className="text-muted" style={{ fontSize: '0.75rem', margin: 'var(--space-xs) 0 0 0' }}>
            {project.commitCount} commits
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const greeting = getGreeting();

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-3xl)' }}>
        <h1 style={{ marginBottom: 'var(--space-md)' }}>Good {greeting}, Soma</h1>
        <p className="text-muted" style={{ fontSize: '1rem' }}>
          Here are your active projects and recent work.
        </p>
      </div>

      {/* Projects Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-xl)',
        }}
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
