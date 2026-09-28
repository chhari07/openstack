// Counts page changes inside Stack, so a "back" button can tell whether the
// previous page is ours. Otherwise (a link or notification opened the page
// directly) going back would leave the app or land on a blank tab.
let pages = 0;
let last: string | null = null;
export const countPage = (path: string) => {
  if (path === last) return; // React may run the effect twice for one page
  last = path;
  pages++;
};
export const canGoBack = () => pages > 1;
