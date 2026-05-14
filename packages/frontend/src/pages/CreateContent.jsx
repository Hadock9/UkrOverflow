import { Link } from 'react-router-dom';
import { CONTENT_TYPES, CONTENT_TYPE_DEFINITIONS } from '../constants/contentTypes';
import '../styles/brutalism.css';

const ACTIVE_LINKS = {
  [CONTENT_TYPES.QUESTION]: '/questions/new',
};

export function CreateContent() {
  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">СТВОРИТИ КОНТЕНТ</h1>
          <p className="page-subtitle">
            Knowledge hub об'єднує питання, статті, міні-гайди, snippets, roadmap-и, best practices та FAQ.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {CONTENT_TYPE_DEFINITIONS.filter((item) => item.id !== CONTENT_TYPES.ALL).map((item) => {
          const link = ACTIVE_LINKS[item.id];

          return (
            <div key={item.id} className="question-card" style={{ minHeight: '220px' }}>
              <div className="question-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="tag">{item.shortLabel}</span>
                  <span className="badge">{item.available ? 'ДОСТУПНО' : 'СКОРО'}</span>
                </div>

                <div>
                  <h3 style={{ marginBottom: 'var(--space-2)' }}>{item.label}</h3>
                  <p style={{ margin: 0 }}>{item.description}</p>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  {link ? (
                    <Link to={link} className="btn btn-primary">
                      СТВОРИТИ {item.shortLabel.toUpperCase()}
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-secondary" disabled>
                      СКОРО БУДЕ ДОСТУПНО
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CreateContent;
