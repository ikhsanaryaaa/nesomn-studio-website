import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Badge, Button } from '@radix-ui/themes';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { PageState } from '@/components/page-state';
import { AssetMedia } from '@/components/store/asset-media';
import { Seo } from '@/components/seo';
import { portfolioApi } from '@/lib/portfolio';
import './works.css';

const PAGE_SIZE = 12;
const samplePath = '/demo/works/nesomn-studio-kit';
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(value),
  );

export default function WorksPage() {
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPage = useRef(page);
  const query = useQuery({
    queryKey: ['public-works', page],
    queryFn: ({ signal }) => portfolioApi.list(page, signal),
  });
  useEffect(() => {
    if (!query.isFetching && previousPage.current !== page) {
      heading.current?.focus({ preventScroll: true });
      previousPage.current = page;
    }
  }, [page, query.isFetching]);
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  const navigatePage = (next: number) => {
    setParams(next === 1 ? {} : { page: String(next) });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  return (
    <MarketingShell active="works">
      <Seo
        title="Works"
        description="Explore the ideas, details, and outcomes behind Nesomn Studio projects and clearly labelled internal concepts."
      />
      <section className="works-page marketing-container" aria-labelledby="works-title">
        <header className="works-intro">
          <div>
            <span className="works-eyebrow">NESOMN / WORKS</span>
            <h1 ref={heading} tabIndex={-1} id="works-title">
              Ideas, out
              <br />
              in the world.
            </h1>
          </div>
          <div className="works-intro-note">
            <p>A closer look at the ideas, details, and outcomes behind our creative work.</p>
            <Link className="works-sample-link" to={samplePath}>
              Explore the Studio Kit concept <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </header>
        {query.isLoading ? (
          <div className="works-state">
            <PageState title="Loading works…" loading>
              <p>Bringing the projects into view.</p>
            </PageState>
          </div>
        ) : query.isError ? (
          <div className="works-state">
            <PageState title="Unable to load works" retry={() => void query.refetch()}>
              <p>Please try again in a moment.</p>
            </PageState>
          </div>
        ) : query.data?.items.length ? (
          <>
            <ol className="works-grid" aria-label="Published portfolio projects">
              {query.data.items.map((work, index) => (
                <li key={work.id} className={index === 0 ? 'works-featured' : ''}>
                  <Link className="works-card" to={'/works/' + encodeURIComponent(work.slug)}>
                    <div className="works-card-visual">
                      <AssetMedia
                        key={work.cover?.url ?? work.id}
                        src={work.cover?.url}
                        title={work.title}
                      />
                      {work.isSample && (
                        <Badge className="works-sample-badge" radius="full" size="2">
                          Demo / Sample
                        </Badge>
                      )}
                      <span className="works-card-arrow" aria-hidden="true">
                        <ArrowUpRight size={24} />
                      </span>
                    </div>
                    <div className="works-card-caption">
                      <div>
                        <h2>{work.title}</h2>
                        {work.client && <p>{work.client}</p>}
                        {!work.client && work.isSample && <p>Internal concept project</p>}
                      </div>
                      {work.projectDate && (
                        <time dateTime={work.projectDate}>{dateLabel(work.projectDate)}</time>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
            {pages > 1 && (
              <nav className="works-pagination" aria-label="Works pagination">
                <Button
                  variant="surface"
                  color="gray"
                  radius="full"
                  disabled={page <= 1}
                  onClick={() => navigatePage(page - 1)}
                >
                  <ArrowLeft size={17} aria-hidden="true" /> Previous
                </Button>
                <span aria-live="polite">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="surface"
                  color="gray"
                  radius="full"
                  disabled={page >= pages}
                  onClick={() => navigatePage(page + 1)}
                >
                  Next <ArrowRight size={17} aria-hidden="true" />
                </Button>
              </nav>
            )}
          </>
        ) : (
          <div className="works-empty works-state">
            <PageState
              title={page > 1 ? 'No projects on this page' : 'The next chapter is taking shape.'}
            >
              <p>
                {page > 1
                  ? 'Return to the first page to explore the available projects.'
                  : 'Published projects will appear here. You can explore our labelled internal concept in the meantime.'}
              </p>
            </PageState>
            <Button asChild radius="full">
              {page > 1 ? (
                <Link to="/works">
                  Back to all works <ArrowLeft size={17} aria-hidden="true" />
                </Link>
              ) : (
                <Link to={samplePath}>
                  View the sample project <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              )}
            </Button>
          </div>
        )}
        <aside className="works-closing">
          <span>Have a different starting point?</span>
          <a href="mailto:contact@nesomn.studio">
            Let’s make something. <ArrowUpRight size={22} aria-hidden="true" />
          </a>
        </aside>
      </section>
    </MarketingShell>
  );
}
