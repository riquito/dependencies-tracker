import { useState } from 'react'

export type RepoFIlterProps = {
    repositories: string[],
    selectedRepositories: Set<string>,
    onChange: (selectedRepos: Set<string>) => void,
}

export function RepoFilter(props: RepoFIlterProps) {
    const {
        repositories,
        selectedRepositories,
        onChange,
    } = props;

    const [selected, setSelected] = useState(selectedRepositories);


    return (
        <div className="repo-filter" >
            <div className="repo-filter-content" >
                {selected.size === repositories.length
                    ? <button onClick={() => setSelected(new Set([]))}>Disable all</button>
                    : <button onClick={() => setSelected(new Set(repositories))}>Enable all</button>
                }
                {
                    props.repositories.map((repo) => {
                        return (
                            <div className="repo-filter-content-item" key={repo} >
                                <label style={{ cursor: 'pointer' }} >
                                    {repo}
                                    <input type="checkbox" id={repo} name={repo} value={repo} checked={selected.has(repo)} onChange={(ev) => {
                                        if (ev.target.checked) {
                                            selected.add(repo);
                                        } else {
                                            selected.delete(repo);
                                        }
                                        setSelected(new Set(selected));
                                    }} />
                                </label>
                            </div>
                        )
                    }
                    )}
                <button onClick={(_: React.MouseEvent<HTMLButtonElement>) => {
                    onChange(selected)
                }}>Apply changes</button>
            </div>
        </div>
    )
}
