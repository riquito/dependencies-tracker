export const Themes = ['light', 'dark', 'auto'] as const;
export type ThemeType = (typeof Themes)[number];

const THEME_KEY = 'theme-preference';

export const getThemePreference = (): ThemeType => {
  return (localStorage.getItem(THEME_KEY) as ThemeType) || 'auto';
};

export const setThemePreference = (theme: ThemeType) => {
  localStorage.setItem(THEME_KEY, theme);
};

export type ThemeProps = {
  value: ThemeType;
  onChange: (theme: ThemeType) => void;
};

export function Theme({ value, onChange }: ThemeProps) {
  return (
    <label className="theme-select">
      Theme
      <select onChange={(ev) => onChange(ev.currentTarget.value as ThemeType)} value={value}>
        <option value="auto">🌗 OS default</option>
        <option value="light">☀️ Light</option>
        <option value="dark">🌒 Dark</option>
      </select>
    </label>
  );
}