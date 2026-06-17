import { describe, expect, it } from 'bun:test';
import { parseListQuery } from './admin-query.ts';

describe('admin-query parseListQuery', () => {
  it('default ke offset 0 dan limit wajar bila tanpa parameter', () => {
    const r = parseListQuery({});
    expect(r.offset).toBe(0);
    expect(r.limit).toBeGreaterThan(0);
    expect(r.order).toBe('asc');
  });

  it('menghitung limit dari rentang _start/_end', () => {
    const r = parseListQuery({ _start: '10', _end: '35' });
    expect(r.offset).toBe(10);
    expect(r.limit).toBe(25);
  });

  it('membatasi limit maksimum 200', () => {
    const r = parseListQuery({ _start: '0', _end: '5000' });
    expect(r.limit).toBe(200);
  });

  it('menormalkan _order ke lowercase desc/asc', () => {
    expect(parseListQuery({ _order: 'DESC' }).order).toBe('desc');
    expect(parseListQuery({ _order: 'asc' }).order).toBe('asc');
  });

  it('meneruskan _sort sebagai nama field', () => {
    expect(parseListQuery({ _sort: 'title' }).sort).toBe('title');
  });
});
