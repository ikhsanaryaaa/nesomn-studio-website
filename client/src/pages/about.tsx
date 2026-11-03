import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { ArrowUpRight, Box, Layers, Mail, Instagram, Library } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Seo } from '@/components/seo';
import './about.css';
import { ContactIcon } from '@/components/marketing/contact-icon';

const contacts = [
  {
    label: 'Email',
    value: 'contact@nesomn.studio',
    href: 'mailto:contact@nesomn.studio',
    icon: <Mail aria-hidden="true" />,
  },
  {
    label: 'Gmail',
    value: 'nesomnstudio@gmail.com',
    href: 'mailto:nesomnstudio@gmail.com',
    icon: <ContactIcon kind="gmail" />,
  },
  {
    label: 'WhatsApp',
    value: '+62 851 8315 9776',
    href: 'https://wa.me/6285183159776',
    icon: <ContactIcon kind="whatsapp" />,
  },
  {
    label: 'Instagram',
    value: '@nesomnstudio',
    href: 'https://www.instagram.com/nesomnstudio/',
    icon: <Instagram aria-hidden="true" />,
  },
  {
    label: 'Telegram',
    value: '@nesomnstudio',
    href: 'https://t.me/nesomnstudio',
    icon: <ContactIcon kind="telegram" />,
  },
];

export default function AboutPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#contact') document.getElementById('contact')?.scrollIntoView({ block: 'start' });
  }, [hash]);
  return (
    <MarketingShell active="about">
      <Seo
        title="About Us"
        description="Get to know Nesomn Studio: a creative platform for scenes, 3D mockups and assets. Contact us about your next idea."
      />
      <section className="about-page marketing-container" aria-labelledby="about-title">
        <span className="about-eyebrow">NESOMN / ABOUT US</span>
        <h1 id="about-title">
          Room for your
          <br />
          <span>next idea.</span>
        </h1>
        <div className="about-introduction">
          <p>
            Nesomn brings creative tools, assets, and projects together in one browser-based
            workspace.
          </p>
          <p>
            Build a composition in the Scene Editor, explore a different perspective in 3D, or find
            an asset that gives your next project a starting point. Your ideas set the direction.
          </p>
        </div>
        <div className="about-capabilities" aria-label="The creative platform">
          {[
            {
              icon: Layers,
              title: 'Compose in 2D.',
              text: 'Arrange images, text, and mockups in the Scene Editor.',
            },
            {
              icon: Box,
              title: 'Explore in 3D.',
              text: 'Work with models, materials, lighting, and camera angles.',
            },
            {
              icon: Library,
              title: 'Find your starting point.',
              text: 'Explore the Asset Store and keep purchased assets in your library.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <Icon size={25} aria-hidden="true" />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <section className="about-contact" id="contact" aria-labelledby="contact-title">
          <div>
            <span className="about-eyebrow">LET’S TALK</span>
            <h2 id="contact-title">
              Have something
              <br />
              in mind?
            </h2>
            <p>Tell us about your idea, ask a question, or start a conversation.</p>
          </div>
          <ul>
            {contacts.map(({ label, value, href, icon }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(href.startsWith('https:')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  <span className="about-contact-icon">{icon}</span>
                  <span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </span>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </MarketingShell>
  );
}
