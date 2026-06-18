import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { projects } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';

/**
 * Project API (butuh auth): CRUD karya editor milik user.
 * State editor (2D/3D) disimpan sebagai JSON di kolom `projects.state`.
 * Semua akses by id wajib memvalidasi ownership (user lain ditolak).
 */

const projectKindSchema = z.enum(['scene2d', 'scene3d']);

const createBody = z.object({
  title: z.string().min(1).max(200),
  kind: projectKindSchema,
  state: z.record(z.unknown()).optional(),
  thumbnailKey: z.string().optional(),
});

const updateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  state: z.record(z.unknown()).optional(),
  thumbnailKey: z.string().nullable().optional(),
});

/** Ambil project milik user (atau lempar 404 jika tidak ada / bukan miliknya). */
async function getOwned(userId: string, id: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
  });
  if (!project) throw new AppError('NOT_FOUND', 'Project tidak ditemukan.', 404);
  return project;
}

export const projectRoutes = new Elysia({ prefix: '/projects' })
  .use(authPlugin)
  // Daftar project milik user (ringkas, tanpa state berat).
  .get(
    '/',
    async ({ user, query }) => {
      const u = user as AuthUser;
      const kind = query.kind ? projectKindSchema.parse(query.kind) : undefined;
      const rows = await db.query.projects.findMany({
        where: kind
          ? and(eq(projects.userId, u.id), eq(projects.kind, kind))
          : eq(projects.userId, u.id),
        orderBy: [desc(projects.updatedAt)],
        columns: { id: true, title: true, kind: true, thumbnailKey: true, updatedAt: true },
      });
      return rows;
    },
    { requireAuth: true },
  )
  // Buat project baru.
  .post(
    '/',
    async ({ body, user }) => {
      const u = user as AuthUser;
      const input = createBody.parse(body);
      const [project] = await db
        .insert(projects)
        .values({
          userId: u.id,
          title: input.title,
          kind: input.kind,
          state: input.state ?? {},
          thumbnailKey: input.thumbnailKey,
        })
        .returning();
      return project;
    },
    { requireAuth: true },
  )
  // Ambil 1 project (validasi ownership).
  .get(
    '/:id',
    async ({ params, user }) => {
      const u = user as AuthUser;
      return getOwned(u.id, params.id);
    },
    { requireAuth: true },
  )
  // Update project (title/state/thumbnail). Set updatedAt.
  .put(
    '/:id',
    async ({ params, body, user }) => {
      const u = user as AuthUser;
      await getOwned(u.id, params.id);
      const input = updateBody.parse(body);
      const [updated] = await db
        .update(projects)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(projects.id, params.id), eq(projects.userId, u.id)))
        .returning();
      return updated;
    },
    { requireAuth: true },
  )
  // Hapus project milik user.
  .delete(
    '/:id',
    async ({ params, user }) => {
      const u = user as AuthUser;
      await getOwned(u.id, params.id);
      await db.delete(projects).where(and(eq(projects.id, params.id), eq(projects.userId, u.id)));
      return { ok: true };
    },
    { requireAuth: true },
  );
