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
