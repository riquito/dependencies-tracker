import { useState } from 'react'
import './repo-filter.css'

export type RepoFIlterProps = {
    repositories: string[],
    selectedRepositories: Set<string>,
    onChange: (selectedRepos: Set<string>) => void,
}

export function RepoFilter(props: RepoFIlterProps) {
    const {
        selectedRepositories,
        onChange,
    } = props;
    let repositories = [...props.repositories];
    repositories.sort((a, b) => a.split('/')[1].localeCompare(b.split('/')[1]));

    const [selected, setSelected] = useState(new Set(selectedRepositories));


    return (
        <div className="repo-filter" >
            <div className="repo-filter-header">
                <h3>Repositories
                    {selected.size === repositories.length
                        ? <button className="btn-link" onClick={() => setSelected(new Set([]))}>Disable all</button>
                        : <button className="btn-link" onClick={() => setSelected(new Set(repositories))}>Enable all</button>
                    }
                    <button className="repo-filter-cancel-btn secondary" onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
                        onChange(new Set([]))
                    }}>Cancel</button>
                </h3>
            </div>
            <div className="repo-filter-content" >
                {
                    repositories.map((repo) => {
                        return (
                            <div tabIndex={0} className={`repo-filter-content-item ${selected.has(repo) ? 'enabled' : 'disabled'}`} key={repo} >
                                <label style={{ cursor: 'pointer' }} title={repo} >
                                    <input type="checkbox" id={repo} name={repo} value={repo} checked={selected.has(repo)} onChange={(ev) => {
                                        if (ev.target.checked) {
                                            selected.add(repo);
                                        } else {
                                            selected.delete(repo);
                                        }
                                        setSelected(new Set(selected));
                                    }} />
                                    {repo.split('/')[1]}
                                </label>
                            </div>
                        )
                    }
                    )}
            </div>
            <button className="repo-filter-cancel-btn secondary" onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
                onChange(new Set([]))
            }}>Cancel</button>
            <button className="repo-filter-apply-btn" disabled={selected.size === 0} onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
                onChange(selected)
            }}>Apply changes</button>
        </div>
    )
}
