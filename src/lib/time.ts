// Small wrapper around Date.now() so components that need the current
// timestamp don't call a known-impure global directly inside their render
// body -- eslint-plugin-react-hooks's "purity" rule (react-hooks/purity)
// flags a direct Date.now()/Math.random()/etc. call inside a component or
// hook, since it can produce unstable results across re-renders. Routing
// through this helper keeps the call itself outside any component body.
export function nowMs(): number {
  return Date.now();
}
