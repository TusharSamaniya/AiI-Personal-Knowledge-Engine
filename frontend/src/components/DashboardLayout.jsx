import DashNavbar from './DashNavbar';

/**
 * Wraps the logged-in pages: a top navbar + the page filling the rest of the screen.
 * The page itself should use `h-full` (not `h-screen`) so it fits under the navbar.
 */
export default function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50">
      <DashNavbar />
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
