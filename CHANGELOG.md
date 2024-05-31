2024-05-30

- Fixed a bug preventing the opening of a repo in a new tab
- Realigned repo icons
- Performance optimizations

2024-05-28

- every dependency node can now be collapsed

2024-05-21

- Ensure that we compile the was module once
- Fix a bug that prevented opening a version tree after clicking
  the external-repository url

2024-05-20

- Display a skeleton when search is in progress
- Do not reload the whole page when a version is clicked
- [perf] Render subtrees only when expanded
- Add `repos` query parameter to share a query with filtered repos
- Accept queries without spaces, such as foo>1

2024-05-19

- Use a favicon visible in dark and light mode
- When we're not searching every repository, highlight
  that fact in the UI
- Add an extra "apply" button on top of the filter-repo dialog
- Better stats for the search results
- Use an higher contrast color when blinking items in light theme
- Performance improvements when closing/opening the filter-repo dialog

2024-05-18

- Anchor the layout so it doesn't move depending on the content

2024-05-17

- When you load the app with a query set as query parameter,
  the input field contains the query
- When a user submits a query with a plain version, match
  the exact version, not the caret version
- Preload necessary data before rendering
- Avoid FOC while loading fonts/images

2024-05-16

- More accessible colors for links in dark theme
- Display both the dependency version and the descriptor
  that brought it in.
- Display stats about the results of the query
- Removed debug logs from WASI library

2024-05-15

- Display a link to github next to each repository
- Allow to set a different hostname instead of github.com

2024-05-14

- Navigating the browser history replay the queries

2024-05-13

- Add a query parameter `q` to start the page with a query
- Change url when a a query is submitted so that it can be shared
