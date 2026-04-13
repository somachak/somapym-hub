import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projects } from '../data/projects';

export default function AppDetail() {
  const { slug } = useParams();
  const project = projects.find((p) => p.slug === slug);

  const [pipelineState, setPipelineState] = useState(
    () => project?.pipeline.map((item) => item.completed) ?? []
  );
  const [copied, setCopied] = useState(false);

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

  const toggleStep = (idx) => {
    setPipelineState((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const handleCopyPath = () => {
    if (project.localPath) {
      navigator.clipboard.writeText(project.localPath).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const commitsUrl = project.gitHubUrl ? `${project.gitHubUrl}/commits/main` : null;

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
            className={`badge ${project.status === 'In Progress' || project.status === 'Active' ? 'badge-primary' : 'badge-secondary'}`}
          >
            {project.status}
          </span>
        </div>
        <p className="text-muted" style={{ fontSize: '1rem' }}>
          {project.description}
        </p>

        {/* Local Path */}
        {project.localPath && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              marginTop: 'var(--space-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.375rem 0.75rem',
              maxWidth: '100%',
            }}
          >
            <code
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {project.localPath}
            </code>
            <button
              onClick={handleCopyPath}
              title="Copy path"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: copied ? 'var(--accent)' : 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              <span className="icon" style={{ fontSize: '1rem' }}>
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        )}

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
            {project.pipeline.map((item, idx) => {
              const completed = pipelineState[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleStep(idx);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    paddingBottom: 'var(--space-md)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    ...(idx < project.pipeline.length - 1 && {
                      borderBottom: '1px solid var(--border)',
                      marginBottom: 'var(--space-md)',
                    }),
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '1.5rem',
                      color: completed ? 'var(--accent)' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {completed ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span
                    style={{
                      fontWeight: completed ? '600' : '500',
                      color: completed ? 'var(--text)' : 'var(--text-muted)',
                    }}
                  >
                    {item.step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Recent Commits */}
        <div>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Recent Commits</h3>
          <div className="card-subtle">
            {project.recentCommits.length === 0 && (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                No commits yet.
              </p>
            )}
            {project.recentCommits.map((commit, idx) => (
              <div
                key={idx}
                style={{
                  paddingBottom: 'var(--space-md)',
                  ...(idx < project.recentCommits.length - 1 && {
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 'var(--space-md)',
                  }),
                }}
              >
                {commitsUrl ? (
                  <a
                    href={commitsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      margin: 0,
                      fontSize: '0.9375rem',
                      fontWeight: '500',
                      marginBottom: '0.25rem',
                      display: 'block',
                      color: 'var(--sky)',
                      textDecoration: 'none',
                    }}
                  >
                    {commit.message}
                  </a>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                    {commit.message}
                  </p>
                )}
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
          {project.gitHubUrl && (
            <a
              href={project.gitHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <span className="icon icon-sm">code</span>
              GitHub
            </a>
          )}
          {project.deployUrl && (
            <a
              href={project.deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <span className="icon icon-sm">open_in_new</span>
              Open App
            </a>
          )}
          {project.gitHubUrl && (
            <a
              href={`${project.gitHubUrl}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              <span className="icon icon-sm">dashboard</span>
              Sprint Board
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
