import { Link } from 'react-router';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';

export default function NotFoundPage() {
  return (
    <>
      <Seo title="404 - Page not found" />
      <div className="not-found-page">
        <span className="not-found-code">404</span>
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-description">
          The page you're looking for may have moved or may not exist.
        </p>
        <Button asChild>
          <Link to="/">
            <Home />
            Back to home
          </Link>
        </Button>
      </div>
    </>
  );
}
