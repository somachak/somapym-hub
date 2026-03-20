import { useParams, Link } from 'react-router-dom';
import { projects } from '../data/projects';

export default function AppDetail() {
  const { slug } = useParams();
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    return (
      <div>
        <Link to="/" className="btn btn-ghost" style={{ marginBottom: 'var(--space-xl)' }}>
          <span className="icon icon-sm">arrow_back</span>
          Back to Dashboard
        </Link>
        <p className="text-muted">Project not found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Back Link */}
      <Link to="/" className="btn btn-ghost" style={{ marginBottom: 'var(--space-2xl)' }}>
        <span className="icon icon-sm">arrow_back</span>
        Back to Dashboard
      </Link>

      {/* Project Header */}
      <div style={{ marginBottom: 'var(--space-3xl)' }}>
        <div className="flex items-center gap-lg mb-lg">
          <h1 style={{ margin: 0 }}>{project.name}</h1>
          <span
            className={`badge ${project.status === 'In Progress' ? 'badge-primary' : 'badge-secondary'}`}
          >
            {project.status}
          </span>
        </div>
        <p className="text-muted" style={{ fontSize: '1rem' }}>
          {project.description}
        </p>
        <div className="flex" style={{ flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
          {project.techStack.map((tech, idx) => (
            <span key={idx} className="tag">
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-2xl)',
          marginBottom: 'var(--space-3xl)',
        }}
      >
        {/* Left Column: Pipeline */}
        <div>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Launch Pipeline</h3>
          <div className="card-subtle">
            {project.pipeline.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  paddingBottom: 'var(--space-md)',
                  ...(idx < project.pipeline.length - 1 && {
                    borderBottom: `1px solid var(--border)`,
                    marginBottom: 'var(--space-md)',
                  }),
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: item.completed ? 'var(--accent)' : 'var(--surface-high)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.completed ? 'white' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                >
                  <span className="icon" style={{ fontSize: '1rem' }}>
                    {item.completed ? 'check' : 'schedule'}
                  </span>
                </div>
                <span style={{ fontWeight: item.completed ? '600' : '500', color: 'var(--text)' }}>
                  {item.step}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recent Commits */}
        <div>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Recent Commits</h3>
          <div className="card-subtle">
            {project.recentCommits.map((commit, idx) => (
              <div
                key={idx}
                style={{
                  paddingBottom: 'var(--space-md)',
                  ...(idx < project.recentCommits.length - 1 && {
                    borderBottom: `1px solid var(--border)`,
                    marginBottom: 'var(--space-md)',
                  }),
                }}
              >
                <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                  {commit.message}
                </p>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
                  {commit.date}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 style={{ marginBottom: 'var(--space-lg)' }}>Quick Actions</h3>
        <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
          <a
            href={project.gitHubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <span className="icon icon-sm">open_in_new</span>
            View on GitHub
          </a>
          <button className="btn btn-ghost">
            <span className="icon icon-sm">apps</span>
            Open App
          </button>
          <button className="btn btn-ghost">
            <span className="icon icon-sm">dashboard</span>
            Sprint Board
          </button>
        </div>
      </div>
    </div>
  );
}
