import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MDXProvider } from '@mdx-js/react';

import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { mdxComponents } from '@/components/mdx-components';

export const Route = createFileRoute('/(pages)')({
  component: PagesLayout,
});

// The whole group — guides, about, legal — shares the marketing chrome so every
// static page carries the nav, the language switch and the footer link mass.
// Width is deliberately NOT set here: a keyword page runs the workbench at the
// homepage's measure while its prose stays on a reading column, and only the
// page itself can lay out both.
function PagesLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <MDXProvider components={mdxComponents}>
          <Outlet />
        </MDXProvider>
      </main>
      <Footer />
    </div>
  );
}
