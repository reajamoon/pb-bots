// Strictly normalize AO3 work or series URLs to canonical form:
// https://archiveofourown.org/works/<workID> or https://archiveofourown.org/series/<seriesID>
export function normalizeAO3Url(url) {
  if (typeof url !== 'string') return url;
  const match = url.match(/^(https?:\/\/archiveofourown\.org\/(works|series)\/\d+)/i);
  if (match) {
    return match[1];
  }
  return url;
}
export default normalizeAO3Url;
