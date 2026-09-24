// A node deep link must open the graph rather than render a hidden detail panel.
export function initialProjectBrainView(params, views) {
  const explicit = params.get('view');
  if (explicit && Object.hasOwn(views, explicit)) return explicit;
  return params.get('node') ? 'graph' : 'overview';
}
