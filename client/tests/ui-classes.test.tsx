import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Input } from '../src/components/ui/input';
import { Button } from '../src/components/ui/button';
import { AppTheme } from '../src/components/app-theme';
import { Slider } from '../src/components/ui/slider';
import { Dialog, DialogTrigger, DialogClose } from '../src/components/ui/dialog';

test('invalid inputs retain caller classes, labels and error association', () => {
  const markup = renderToStaticMarkup(
    <Input id="fixture-email" label="Email" error="Invalid email" className="caller-field" />,
  );
  expect(markup).toContain('rt-TextFieldRoot');
  expect(markup).toContain('rt-TextFieldInput');
  expect(markup).toContain('ui-input--invalid caller-field');
  expect(markup).toContain('aria-invalid="true"');
  expect(markup).toContain('aria-describedby="fixture-email-error"');
  expect(markup).toContain('for="fixture-email"');
  expect(markup).toContain('id="fixture-email-error"');
});

test('button semantic variants preserve class overrides and slot links', () => {
  const markup = renderToStaticMarkup(
    <Button asChild size="icon" variant="secondary" className="caller-action">
      <a href="/pricing">Pricing</a>
    </Button>,
  );
  expect(markup).toContain('rt-IconButton');
  expect(markup).toContain('rt-variant-surface');
  expect(markup).toContain('ui-button--secondary');
  expect(markup).toContain('ui-button--icon');
  expect(markup).toContain('caller-action');
  expect(markup).toContain('href="/pricing"');
  expect(markup).not.toContain('<button');
});

test('application SSR renders an actual orange Radix Themes provider', () => {
  const markup = renderToStaticMarkup(
    <AppTheme>
      <Button>Login</Button>
    </AppTheme>,
  );
  expect(markup).toContain('radix-themes light nesomn-theme-root');
  expect(markup).toContain('data-accent-color="orange"');
  expect(markup).toContain('data-gray-color="sand"');
  expect(markup).toContain('rt-Button');
});

test('slider thumbs keep their accessible labels with the Themes skin', () => {
  const markup = renderToStaticMarkup(
    <AppTheme>
      <Slider aria-label="Grain" value={[12]} max={100} />
    </AppTheme>,
  );
  expect(markup).toContain('rt-SliderRoot');
  expect(markup).toContain('rt-variant-surface');
  expect(markup).toMatch(
    /role="slider"[^>]*aria-label="Grain"|aria-label="Grain"[^>]*role="slider"/,
  );
});

test('dialog adapters retain native buttons for plain text children', () => {
  const markup = renderToStaticMarkup(
    <AppTheme>
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogClose>Close</DialogClose>
      </Dialog>
    </AppTheme>,
  );
  expect(markup).toMatch(/<button[^>]*>Open<\/button>/);
  expect(markup).toMatch(/<button[^>]*>Close<\/button>/);
});
