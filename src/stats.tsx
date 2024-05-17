import { YarnWhyJSONOutput } from './yarn-why';
import './stats.css';
import { useMemo } from 'react';

/**
 * Given YarnWhyJSONOutput, it return
 * statistics about how often each version
 * has been encountered
 */
function getStats(result: YarnWhyJSONOutput, isTargetPackage: IsTargetPackage) {
  return result.reduce(
    (acc, node) => {
      if (isTargetPackage(node.descriptor[0])) {
        const version = node.version;
        let versionStats = acc[version] || 0;
        versionStats++;
        acc[version] = versionStats;
      }

      if (node.children) {
        const childrenStats = getStats(node.children, isTargetPackage);
        acc = combineStats([acc, childrenStats]);
      }

      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Given an array of stats (a Record<string, number>), returns
 * a new Record<string, number> with the sum of all the stats.
 * e.g.
 *
 * ```
 * combineStats([{a: 2, b:3}, {a:1, d:7}]) == {a: 3, b:3, d:7}
 * ```
 */
function combineStats(stats: Record<string, number>[]): Record<string, number> {
  return stats.reduce(
    (acc, stat) => {
      return Object.keys(stat).reduce((acc, key) => {
        const value = stat[key] || 0;
        const accValue = acc[key] || 0;
        acc[key] = accValue + value;
        return acc;
      }, acc);
    },
    {} as Record<string, number>
  );
}

type StatsProps = {
  searchResult: [string, YarnWhyJSONOutput][];
  packageQuery: string;
};

export function Stats({ searchResult, packageQuery }: StatsProps) {
  const packageName = packageQuery.split(' ')[0];
  const stats = useMemo(() => {
    const isTargetPackage = (name: string) => name === packageName;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return Object.entries(combineStats(searchResult.map(([_, result]) => getStats(result, isTargetPackage)))).sort(
      (a, b) => b[1] - a[1]
    );
  }, [searchResult, packageName]);

  return (
    <div className="stats">
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <b>{searchResult.reduce((acc, [_, result]) => acc + result.length, 0)}</b> top level dependencies found across{' '}
      <b>{searchResult.length}</b> repositories
      <div>
        <details>
          <summary>
            <b>
              Found{' '}
              {Object.keys(stats).length === 1 ? 'only 1 version' : `${Object.keys(stats).length} different versions`}
            </b>
          </summary>
          <div>
            <div className="stats-warning-info">
              (the number of occurrences is an estimate since every dependency's subtree is printed just once)
            </div>
            <div className="stats-occurrences-title">occurrences / versions</div>
            <div className="stats-occurrences">
              {stats.map(([key, value]) => {
                return (
                  <div className="stats-occurrences-row" key={key}>
                    <div className="stats-occurrences-cell-occurrences">{value}</div>
                    <div className="stats-occurrences-cell-version">
                      <a href={`${window.location.pathname}?q=${encodeURIComponent(`${packageName} ${key}`)}`}>{key}</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
