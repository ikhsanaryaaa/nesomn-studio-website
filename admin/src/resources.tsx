import type { ResourceProps } from '@refinedev/core';
import {
  DatabaseOutlined,
  AppstoreOutlined,
  CreditCardOutlined,
  GiftOutlined,
  TeamOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  DesktopOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';

/**
 * Definisi resource Refine: tiap entri memetakan nama resource ke rute
 * list/create/edit/show dan meta (ikon + label menu). Grouping menjaga menu
 * tetap rapi: Katalog, Pengguna, AI, Sistem.
 */
export const resources: ResourceProps[] = [
  {
    name: 'assets',
    list: '/assets',
    create: '/assets/create',
    edit: '/assets/edit/:id',
    show: '/assets/show/:id',
    meta: { label: 'Assets', icon: <DatabaseOutlined />, parent: 'catalog' },
  },
  {
    name: 'bundles',
    list: '/bundles',
    create: '/bundles/create',
    edit: '/bundles/edit/:id',
    show: '/bundles/show/:id',
    meta: { label: 'Bundles', icon: <AppstoreOutlined />, parent: 'catalog' },
  },
  {
    name: 'plans',
    list: '/plans',
    create: '/plans/create',
    edit: '/plans/edit/:id',
    meta: { label: 'Plans', icon: <CreditCardOutlined />, parent: 'catalog' },
  },
  {
    name: 'credit-packs',
    list: '/credit-packs',
    create: '/credit-packs/create',
    edit: '/credit-packs/edit/:id',
    meta: { label: 'Credit Packs', icon: <GiftOutlined />, parent: 'catalog' },
  },
  {
    name: 'users',
    list: '/users',
    show: '/users/show/:id',
    meta: { label: 'Users', icon: <TeamOutlined /> },
  },
  {
    name: 'ai-providers',
    list: '/ai-providers',
    create: '/ai-providers/create',
    edit: '/ai-providers/edit/:id',
    meta: { label: 'AI Providers', icon: <ApiOutlined />, parent: 'ai' },
  },
  {
    name: 'usage',
    list: '/usage',
    meta: { label: 'Usage (Credit Cost)', icon: <ThunderboltOutlined />, parent: 'ai' },
  },
  {
    name: 'sessions',
    list: '/sessions',
    meta: { label: 'Sessions', icon: <DesktopOutlined />, parent: 'system' },
  },
  {
    name: 'audit-logs',
    list: '/audit-logs',
    meta: { label: 'Audit Logs', icon: <FileSearchOutlined />, parent: 'system' },
  },
  { name: 'catalog', meta: { label: 'Katalog' } },
  { name: 'ai', meta: { label: 'AI System' } },
  { name: 'system', meta: { label: 'Sistem' } },
];
