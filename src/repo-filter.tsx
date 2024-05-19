import { useEffect, useRef, useState } from 'react';
import './repo-filter.css';

export type RepoFIlterProps = {
  repositories: string[];
  selectedRepositories: Set<string>;
  onChange: (selectedRepos: Set<string>) => void;
};

export function RepoFilter(props: RepoFIlterProps) {
  const { selectedRepositories, onChange } = props;
  const repositories = [...props.repositories];
  repositories.sort((a, b) => a.split('/')[1].localeCompare(b.split('/')[1]));

  const [selected, setSelected] = useState(new Set(selectedRepositories));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      (ref.current.querySelectorAll('button.repo-filter-cancel-btn')[0] as HTMLButtonElement).focus();
    }
  }, []);

  return (
    <div className="repo-filter" ref={ref}>
      <div className="repo-filter-header">
        <h3>
          Repositories
          {selected.size === repositories.length ? (
            <button className="btn-link" onClick={() => setSelected(new Set([]))}>
              Disable all
            </button>
          ) : (
            <button className="btn-link" onClick={() => setSelected(new Set(repositories))}>
              Enable all
            </button>
          )}
          <button
            className="repo-filter-cancel-btn secondary"
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
              onChange(new Set([]));
            }}
          >
            Cancel
          </button>
          <button
            className="repo-filter-apply-btn"
            disabled={selected.size === 0}
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
              onChange(selected);
            }}
          >
            Apply changes
          </button>
        </h3>
      </div>
      <div className="repo-filter-content">
        {repositories.map((repo) => {
          return (
            <div className={`repo-filter-content-item ${selected.has(repo) ? 'enabled' : 'disabled'}`} key={repo}>
              <label style={{ cursor: 'pointer' }} title={repo}>
                <input
                  tabIndex={0}
                  type="checkbox"
                  id={repo}
                  name={repo}
                  value={repo}
                  checked={selected.has(repo)}
                  onChange={(ev) => {
                    if (ev.target.checked) {
                      selected.add(repo);
                    } else {
                      selected.delete(repo);
                    }
                    setSelected(new Set(selected));
                  }}
                />
                {repo.split('/')[1]}
              </label>
            </div>
          );
        })}
        {repositories.length % 3 !== 0 &&
          [...Array(3 - (repositories.length % 3))].map((_, idx) => {
            return <div className="repo-filter-content-item empty" key={`empty-${idx}`}></div>;
          })}
      </div>
      <button
        className="repo-filter-cancel-btn secondary bottom"
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
          onChange(new Set([]));
        }}
      >
        Cancel
      </button>
      <button
        className="repo-filter-apply-btn bottom"
        disabled={selected.size === 0}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
          onChange(selected);
        }}
      >
        Apply changes
      </button>
    </div>
  );
}
