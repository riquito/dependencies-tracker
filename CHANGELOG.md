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
