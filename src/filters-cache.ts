const CACHE_KEY = 'repo-filters';

export const getCachedFilters = (): Set<string> => {
  const cachedFilters = localStorage.getItem(CACHE_KEY);
  if (cachedFilters) {
    return new Set(JSON.parse(cachedFilters));
  }
  return new Set([]);
};

export const setCachedFilters = (filters: Set<string>) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(filters)));
};

export const deleteCachedFilters = () => {
  localStorage.removeItem(CACHE_KEY);
};

function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const _intersection = new Set<T>();
  for (const elem of setB) {
    if (setA.has(elem)) {
      _intersection.add(elem);
    }
  }
  return _intersection;
}

// `desiredRepositories` may refer to no-more-existing repositories (you never know)
export function keepOnlyValidRepositories(repositoriesSubset: Set<string>, allRepositories: Set<string>): Set<string> {
  return intersection(repositoriesSubset, allRepositories);
}
