/** Hand a link to the phone's share sheet when there is one, else copy it. */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch {
      /* closed the sheet: copy instead */
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
