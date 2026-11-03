import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, ImageOff, Maximize2, Play, RefreshCw } from 'lucide-react';
import { Badge, Button } from '@radix-ui/themes';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Seo } from '@/components/seo';
import { PageState } from '@/components/page-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { portfolioApi, type PublicWork, type WorkMedia } from '@/lib/portfolio';
import { SAMPLE_WORK } from '@/lib/portfolio-sample';
import './work-detail.css';

function isNotFound(error: unknown) {
  return error instanceof Error && 'status' in error && error.status === 404;
}

function externalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function MediaFailure({ text, retry }: { text: string; retry: () => void }) {
  return (
    <div className="work-media-failure" role="status">
      <ImageOff size={28} aria-hidden="true" />
      <p>{text}</p>
      <Button size="3" color="gray" variant="surface" onClick={retry}>
        <RefreshCw size={16} aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function WorkImage({
  media,
  alt,
  cover = false,
}: {
  media: WorkMedia;
  alt: string;
  cover?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [largeFailed, setLargeFailed] = useState(false);
  const [largeAttempt, setLargeAttempt] = useState(0);
  return (
    <div className={cover ? 'work-image work-cover-image' : 'work-image'}>
      {failed ? (
        <MediaFailure
          text="This image could not be loaded."
          retry={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
        />
      ) : (
        <Dialog
          onOpenChange={(open) => {
            if (open) setLargeFailed(false);
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              className="work-image-open"
              aria-label={'View full image: ' + alt}
            >
              <img
                key={attempt}
                src={media.url}
                alt={alt}
                width={media.width ?? undefined}
                height={media.height ?? undefined}
                loading={cover ? 'eager' : 'lazy'}
                fetchPriority={cover ? 'high' : 'auto'}
                decoding="async"
                onError={() => setFailed(true)}
              />
              <span className="work-image-expand">
                <Maximize2 size={17} aria-hidden="true" />
                <span>View image</span>
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="work-image-dialog" maxWidth="1200px">
            <DialogTitle>Image preview</DialogTitle>
            <DialogDescription>{alt}</DialogDescription>
            {largeFailed ? (
              <MediaFailure
                text="The full image is unavailable."
                retry={() => {
                  setLargeFailed(false);
                  setLargeAttempt(largeAttempt + 1);
                }}
              />
            ) : (
              <img
                key={largeAttempt}
                src={media.url}
                alt={alt}
                className="work-lightbox-image"
                onError={() => setLargeFailed(true)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function WorkVideo({
  media,
  poster,
  caption,
}: {
  media: WorkMedia;
  poster: WorkMedia | null;
  caption: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!stage.current || typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (ready && !failed) video.current?.load();
  }, [ready, attempt, failed]);
  useEffect(() => {
    const element = video.current;
    return () => {
      element?.pause();
      element?.querySelectorAll('source').forEach((source) => source.removeAttribute('src'));
      element?.removeAttribute('src');
      element?.load();
    };
  }, [attempt, failed, media.url]);
  return (
    <div className="work-video" ref={stage}>
      {failed ? (
        <MediaFailure
          text="This video could not be played. Try again or use another supported browser."
          retry={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
        />
      ) : (
        <video
          ref={video}
          key={attempt}
          controls
          playsInline
          preload="metadata"
          poster={ready ? poster?.url : undefined}
          aria-label={caption || 'Project video'}
          onError={() => setFailed(true)}
        >
          {ready && (
            <source src={media.url} type={media.mimeType} onError={() => setFailed(true)} />
          )}
          Your browser does not support this video format.
        </video>
      )}
      <div className="work-video-label">
        <Play size={13} aria-hidden="true" />
        <span>Video · Play to explore</span>
      </div>
    </div>
  );
}

function ProjectContent({ work, sample }: { work: PublicWork; sample: boolean }) {
  const link = externalUrl(work.linkUrl);
  return (
    <article className="work-detail marketing-container">
      <Seo title={work.title} description={work.description.slice(0, 180)} />
      <Link className="work-back-link" to="/works">
        <ArrowLeft size={17} aria-hidden="true" />
        All works
      </Link>
      <header className="work-project-heading">
        <div className="work-project-eyebrow">
          <span>SELECTED WORK</span>
          {work.isSample && (
            <Badge size="2" radius="full">
              Demo / Sample
            </Badge>
          )}
        </div>
        <h1>{work.title}</h1>
        <dl className="work-project-meta">
          {work.projectDate && (
            <div>
              <dt>Project date</dt>
              <dd>
                <time dateTime={work.projectDate}>
                  {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
                    new Date(work.projectDate + 'T00:00:00Z'),
                  )}
                </time>
              </dd>
            </div>
          )}
          {work.client ? (
            <div>
              <dt>Client</dt>
              <dd>{work.client}</dd>
            </div>
          ) : work.isSample ? (
            <div>
              <dt>Project type</dt>
              <dd>Internal concept</dd>
            </div>
          ) : null}
          <div>
            <dt>Studio</dt>
            <dd>Nesomn Studio</dd>
          </div>
        </dl>
        {work.isSample && (
          <p className="work-sample-note">
            An internal concept project, shown as a Demo / Sample. This is not a client commission.
            {sample ? ' You are viewing the explicit sample showcase.' : ''}
          </p>
        )}
      </header>
      {work.cover ? (
        <div className="work-cover">
          <WorkImage
            key={work.cover.id}
            media={work.cover}
            alt={work.title + ' — project cover'}
            cover
          />
        </div>
      ) : (
        <div className="work-cover">
          <div className="work-media-empty">
            <ImageOff size={28} aria-hidden="true" />
            <p>No cover image is available.</p>
          </div>
        </div>
      )}
      <section className="work-project-story" aria-labelledby="work-project-story-title">
        <div>
          <span className="work-detail-kicker">THE PROJECT</span>
          <h2 id="work-project-story-title">
            The idea.
            <br />
            The perspective.
          </h2>
        </div>
        <div className="work-story-copy">
          {work.description
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          {link && work.linkLabel && (
            <Button size="3" radius="full" asChild>
              <a href={link} target="_blank" rel="noopener noreferrer">
                {work.linkLabel}
                <ArrowUpRight size={17} aria-hidden="true" />
                <span className="work-sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          )}
        </div>
      </section>
      <section className="work-gallery" aria-labelledby="work-gallery-title">
        <header className="work-gallery-heading">
          <div>
            <span className="work-detail-kicker">A CLOSER LOOK</span>
            <h2 id="work-gallery-title">In the details.</h2>
          </div>
          <p>
            {work.gallery.length
              ? 'Explore the project, frame by frame.'
              : 'More project images will appear here when available.'}
          </p>
        </header>
        <div className="work-gallery-items">
          {work.gallery.map((item, index) => (
            <figure className="work-gallery-item" key={item.mediaId}>
              {item.media.mimeType.startsWith('image/') ? (
                <WorkImage
                  media={item.media}
                  alt={item.alt || work.title + ' — image ' + (index + 1)}
                />
              ) : (
                <WorkVideo
                  media={item.media}
                  poster={item.poster}
                  caption={item.alt || work.title + ' — video ' + (index + 1)}
                />
              )}
              <figcaption>
                <span className="work-gallery-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{item.alt || item.media.name}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <footer className="work-project-footer">
        <span>More perspectives. More possibilities.</span>
        <Button size="3" color="gray" variant="surface" radius="full" asChild>
          <Link to="/works">
            Back to Works
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </Button>
      </footer>
    </article>
  );
}

export default function WorkDetailPage({ sample = false }: { sample?: boolean }) {
  const { slug } = useParams();
  const query = useQuery({
    queryKey: ['portfolio', 'work', slug],
    queryFn: ({ signal }) => portfolioApi.detail(slug!, signal),
    enabled: !sample && !!slug,
    retry: (count, error) => !isNotFound(error) && count < 1,
  });
  const work = sample ? SAMPLE_WORK : query.data;
  return (
    <MarketingShell active="works">
      {!sample && (!slug || (query.isError && isNotFound(query.error))) ? (
        <section className="work-detail-state marketing-container">
          <Seo title="Work not found" />
          <h1>Work not found.</h1>
          <PageState title="This project is not available">
            It may not be published, or the link may have changed.
          </PageState>
          <Button size="3" radius="full" asChild>
            <Link to="/works">
              Explore Works
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </Button>
        </section>
      ) : !sample && query.isPending ? (
        <section className="work-detail-state marketing-container">
          <Seo title="Project details" />
          <h1>Project details.</h1>
          <PageState title="Loading project…" loading />
        </section>
      ) : !sample && query.isError ? (
        <section className="work-detail-state marketing-container">
          <Seo title="Unable to load project" />
          <h1>A little interruption.</h1>
          <PageState title="Unable to load this project" retry={() => void query.refetch()}>
            Please try again. Your connection or the studio service may be temporarily unavailable.
          </PageState>
          <Link className="work-back-link" to="/works">
            <ArrowLeft size={17} aria-hidden="true" />
            All works
          </Link>
        </section>
      ) : work ? (
        <ProjectContent key={work.id} work={work} sample={sample} />
      ) : null}
    </MarketingShell>
  );
}
