import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigation, useWarnAboutChange } from '@refinedev/core';
import { useParams } from 'react-router';
import {
  AlertDialog,
  Badge,
  Button,
  Callout,
  Card,
  Flex,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextField,
} from '@radix-ui/themes';
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { List, Table, Space, EditButton, DeleteButton, useTable } from '../components/ui';
import {
  uploadWorkMedia,
  workPayload,
  workRequest,
  WorkRequestError,
  type WorkDraft,
  type WorkGalleryItem,
  type WorkMedia,
  type WorkRecord,
} from './works-api';
import './works.css';

export function WorkList() {
  const { tableProps } = useTable({
    resource: 'works',
    syncWithLocation: true,
    sorters: { initial: [{ field: 'updatedAt', order: 'desc' }] },
  });
  return (
    <List resource="works" title="Works">
      <p className="works-description">
        Manage the studio portfolio. Drafts stay private; only published works appear on the public
        website.
      </p>
      <Table {...tableProps}>
        <Table.Column dataIndex="title" title="Title" sorter />
        <Table.Column
          dataIndex="client"
          title="Client"
          render={(value: string | null) => value || '—'}
        />
        <Table.Column
          dataIndex="projectDate"
          title="Date"
          sorter
          render={(value: string | null) => value || 'Not set'}
        />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(value: string) => (
            <Badge color={value === 'published' ? 'green' : 'gray'}>
              {value === 'published' ? 'Published' : 'Draft'}
            </Badge>
          )}
        />
        <Table.Column
          dataIndex="isSample"
          title="Sample"
          render={(value: boolean) => (value ? <Badge color="orange">Demo / Sample</Badge> : '—')}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <EditButton resource="works" recordItemId={record.id} />
              <DeleteButton
                resource="works"
                recordItemId={record.id}
                confirmTitle="Delete this portfolio work?"
              />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
const emptyDraft: WorkDraft = {
  title: '',
  slug: '',
  description: '',
  projectDate: null,
  client: null,
  status: 'draft',
  isSample: false,
  coverMediaId: null,
  linkLabel: null,
  linkUrl: null,
  gallery: [],
};
function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="admin-field-help">{hint}</p>}
    </div>
  );
}
function MediaPreview({ media, poster }: { media: WorkMedia; poster?: WorkMedia | null }) {
  return media.mimeType.startsWith('video/') ? (
    <video
      controls
      preload="metadata"
      src={media.url}
      poster={poster?.url}
      aria-label={media.name}
    />
  ) : (
    <img src={media.url} alt={media.name} />
  );
}
function FileUpload({
  id,
  label,
  accept,
  busy,
  onFile,
}: {
  id: string;
  label: string;
  accept: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label className="admin-file-label works-file" htmlFor={id}>
      <ImagePlus size={18} aria-hidden="true" />
      <span>{label}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}
export function WorkCreate() {
  return <WorkEditor key="create" />;
}
export function WorkEdit() {
  const { id } = useParams();
  return <WorkEditor key={id} id={id} />;
}

function WorkEditor({ id }: { id?: string }) {
  const nav = useNavigation();
  const { setWarnWhen, warnWhen } = useWarnAboutChange();
  const [draft, setDraft] = useState<WorkDraft>(emptyDraft);
  const [revision, setRevision] = useState<number>();
  const [createdId, setCreatedId] = useState<string>();
  const [cover, setCover] = useState<WorkMedia | null>(null);
  const [loading, setLoading] = useState(!!id),
    [loadError, setLoadError] = useState('');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [conflict, setConflict] = useState(false);
  const [dirty, setDirty] = useState(false),
    [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const titleInput = useRef<HTMLInputElement>(null);
  const reloadFocus = useRef(false);
  const uploadLock = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      uploadAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    setWarnWhen(dirty);
    return () => setWarnWhen(false);
  }, [dirty, setWarnWhen]);
  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    setLoading(true);
    setLoadError('');
    workRequest<WorkRecord>('/' + encodeURIComponent(id), { signal: abort.signal })
      .then((record) => {
        setDraft(workPayload(record));
        setCover(record.cover ?? null);
        setDraft((previous) => ({ ...previous, gallery: record.gallery }));
        setRevision(record.revision);
        setDirty(false);
        setConflict(false);
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setLoadError(e instanceof Error ? e.message : 'Unable to load this work.');
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [id, attempt]);
  useEffect(() => {
    if (!loading && !loadError && reloadFocus.current) {
      reloadFocus.current = false;
      titleInput.current?.focus();
    }
  }, [loading, loadError]);
  useEffect(() => {
    if (createdId && !warnWhen) {
      setCreatedId(undefined);
      nav.edit('works', createdId);
    }
  }, [createdId, warnWhen, nav]);
  function change<K extends keyof WorkDraft>(key: K, value: WorkDraft[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
    setDirty(true);
    setNotice('');
  }
  function editGallery(index: number, update: Partial<WorkGalleryItem>) {
    setDraft((old) => ({
      ...old,
      gallery: old.gallery.map((item, i) => (i === index ? { ...item, ...update } : item)),
    }));
    setDirty(true);
    setNotice('');
  }
  function move(index: number, delta: number) {
    const list = [...draft.gallery];
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next]!, list[index]!];
    change('gallery', list);
  }
  async function upload(file: File, target: 'cover' | 'gallery' | number) {
    if (uploadLock.current) return;
    if (target !== 'gallery' && !file.type.startsWith('image/')) {
      setError('Choose an image for the cover or video poster.');
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      uploadAbort.current = new AbortController();
      const media = await uploadWorkMedia(file, uploadAbort.current.signal);
      if (!alive.current) return;
      if (target === 'cover') {
        change('coverMediaId', media.id);
        setCover(media);
      } else if (target === 'gallery') {
        setDraft((old) => ({
          ...old,
          gallery: [...old.gallery, { mediaId: media.id, alt: '', posterMediaId: null, media }],
        }));
        setDirty(true);
      } else editGallery(target, { posterMediaId: media.id, poster: media });
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      uploadLock.current = false;
      if (alive.current) setUploading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || uploading || loading || loadError || conflict) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = workPayload(draft);
      const record = await workRequest<WorkRecord>(id ? '/' + encodeURIComponent(id) : '', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(id ? { ...payload, expectedRevision: revision } : payload),
      });
      if (!alive.current) return;
      setDirty(false);
      setWarnWhen(false);
      setDraft({ ...workPayload(record), gallery: record.gallery });
      setCover(record.cover ?? null);
      setRevision(record.revision);
      setNotice(record.status === 'published' ? 'Work published.' : 'Draft saved.');
      if (!id) setCreatedId(record.id);
    } catch (e) {
      if (!alive.current) return;
      if (id && e instanceof WorkRequestError && e.code === 'WORK_CONFLICT') {
        setConflict(true);
        setError(
          'This work changed on the server. Your edits are still here. Copy any changes you need before reloading the server version.',
        );
      } else setError(e instanceof Error ? e.message : 'Unable to save this work.');
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  const busy = saving || uploading;
  return (
    <section className="admin-page works-editor">
      <header className="admin-page-heading">
        <div>
          <button className="admin-back" type="button" onClick={() => nav.list('works')}>
            ← Back to Works
          </button>
          <h1>{id ? 'Edit work' : 'Create work'}</h1>
        </div>
        <Button
          type="submit"
          form="work-form"
          disabled={busy || loading || !!loadError || conflict}
          loading={saving}
        >
          Save changes
        </Button>
      </header>
      {loading ? (
        <div className="admin-empty" role="status">
          <Spinner /> Loading work…
        </div>
      ) : loadError ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{loadError}</Callout.Text>
          <Button type="button" variant="soft" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </Callout.Root>
      ) : (
        <>
          {error && (
            <Callout.Root color="red" role="alert">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}
          {notice && (
            <Callout.Root role="status">
              <Callout.Text>{notice}</Callout.Text>
            </Callout.Root>
          )}
          {uploading && (
            <Callout.Root role="status">
              <Callout.Text>Uploading media. Keep this page open.</Callout.Text>
            </Callout.Root>
          )}
          {conflict && (
            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button type="button" variant="soft" color="gray">
                  Reload server version
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="440px">
                <AlertDialog.Title>Discard your unsaved edits?</AlertDialog.Title>
                <AlertDialog.Description>
                  The latest server version will replace this form. Copy anything you want to keep
                  first.
                </AlertDialog.Description>
                <Flex justify="end" gap="3" mt="5">
                  <AlertDialog.Cancel>
                    <Button color="gray" variant="soft">
                      Keep editing
                    </Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button
                      onClick={() => {
                        setDirty(false);
                        setWarnWhen(false);
                        reloadFocus.current = true;
                        setAttempt((n) => n + 1);
                      }}
                    >
                      Reload
                    </Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          )}
          <form id="work-form" className="admin-form" onSubmit={save}>
            <fieldset disabled={busy} className="works-fieldset">
              <Card className="admin-form-panel">
                <h2>Project details</h2>
                <Field id="work-title" label="Title">
                  <TextField.Root
                    size="3"
                    id="work-title"
                    ref={titleInput}
                    name="title"
                    value={draft.title}
                    maxLength={160}
                    required
                    onChange={(e) => change('title', e.target.value)}
                  />
                </Field>
                <Field
                  id="work-slug"
                  label="URL slug"
                  hint="Lowercase letters, numbers and hyphens."
                >
                  <TextField.Root
                    size="3"
                    id="work-slug"
                    name="slug"
                    value={draft.slug}
                    required
                    pattern="[a-z0-9](?:[a-z0-9]|-){0,159}"
                    maxLength={160}
                    onChange={(e) => change('slug', e.target.value)}
                  />
                </Field>
                <Field id="work-description" label="Description">
                  <TextArea
                    size="3"
                    id="work-description"
                    name="description"
                    value={draft.description}
                    maxLength={20000}
                    rows={6}
                    required={draft.status === 'published'}
                    onChange={(e) => change('description', e.target.value)}
                  />
                </Field>
                <div className="admin-field-row">
                  <Field id="work-date" label="Project date">
                    <TextField.Root
                      size="3"
                      id="work-date"
                      type="date"
                      value={draft.projectDate ?? ''}
                      required={draft.status === 'published'}
                      onChange={(e) => change('projectDate', e.target.value || null)}
                    />
                  </Field>
                  <Field id="work-client" label="Client (optional)">
                    <TextField.Root
                      size="3"
                      id="work-client"
                      value={draft.client ?? ''}
                      maxLength={160}
                      onChange={(e) => change('client', e.target.value || null)}
                    />
                  </Field>
                </div>
                <div className="admin-field-row">
                  <Field
                    id="work-status"
                    label="Visibility"
                    hint="Publishing requires a cover, description and date."
                  >
                    <Select.Root
                      value={draft.status}
                      onValueChange={(value) => change('status', value as WorkDraft['status'])}
                      size="3"
                    >
                      <Select.Trigger id="work-status" />
                      <Select.Content className="admin-select-content">
                        <Select.Item value="draft">Draft</Select.Item>
                        <Select.Item value="published">Published</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Field>
                  <label className="works-sample-label">
                    <Switch
                      className="admin-switch"
                      checked={draft.isSample}
                      onCheckedChange={(value) => change('isSample', value)}
                    />
                    Demo / Sample — internal concept
                  </label>
                </div>
              </Card>
              <Card className="admin-form-panel">
                <h2>Cover</h2>
                <p className="admin-field-help">
                  PNG, JPEG or WebP, up to 20 MB. Required before publishing.
                </p>
                {cover && (
                  <div className="works-cover-preview">
                    <MediaPreview media={cover} />
                  </div>
                )}
                <FileUpload
                  id="work-cover-upload"
                  label={cover ? 'Replace cover' : 'Upload cover'}
                  accept="image/png,image/jpeg,image/webp"
                  busy={busy}
                  onFile={(file) => void upload(file, 'cover')}
                />
                {cover && (
                  <Button
                    type="button"
                    variant="soft"
                    color="gray"
                    onClick={() => {
                      setCover(null);
                      change('coverMediaId', null);
                    }}
                  >
                    Remove cover
                  </Button>
                )}
              </Card>
              <Card className="admin-form-panel">
                <h2>Gallery</h2>
                <p className="admin-field-help">
                  Add up to 40 images or MP4/WebM videos. Images: 20 MB; video: 100 MB. Files stay
                  in Nesomn storage. Video does not autoplay.
                </p>
                {!draft.gallery.length && <div className="works-empty">No gallery media yet.</div>}
                <ol className="works-gallery">
                  {draft.gallery.map((item, index) => (
                    <li key={item.mediaId} className="works-gallery-item">
                      <div className="works-gallery-preview">
                        {item.media && <MediaPreview media={item.media} poster={item.poster} />}
                      </div>
                      <div className="works-gallery-fields">
                        <strong>
                          {index + 1}. {item.media?.name ?? 'Gallery media'}
                        </strong>
                        <Field
                          id={'work-alt-' + item.mediaId}
                          label={
                            item.media?.mimeType.startsWith('video/')
                              ? 'Video caption'
                              : 'Image description'
                          }
                        >
                          <TextField.Root
                            size="3"
                            id={'work-alt-' + item.mediaId}
                            value={item.alt}
                            maxLength={500}
                            required={
                              draft.status === 'published' &&
                              !item.media?.mimeType.startsWith('video/')
                            }
                            onChange={(e) => editGallery(index, { alt: e.target.value })}
                          />
                        </Field>
                        {item.media?.mimeType.startsWith('video/') && (
                          <>
                            <FileUpload
                              id={'work-poster-' + item.mediaId}
                              label={
                                item.posterMediaId
                                  ? 'Replace video poster'
                                  : 'Add video poster (optional)'
                              }
                              accept="image/png,image/jpeg,image/webp"
                              busy={busy}
                              onFile={(file) => void upload(file, index)}
                            />
                            {item.posterMediaId && (
                              <Button
                                type="button"
                                variant="soft"
                                color="gray"
                                onClick={() =>
                                  editGallery(index, { posterMediaId: null, poster: null })
                                }
                              >
                                Remove poster
                              </Button>
                            )}
                          </>
                        )}
                        <Flex gap="2" wrap="wrap">
                          <Button
                            type="button"
                            variant="soft"
                            color="gray"
                            disabled={index === 0}
                            aria-label={'Move gallery item ' + (index + 1) + ' up'}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp size={16} />
                            Up
                          </Button>
                          <Button
                            type="button"
                            variant="soft"
                            color="gray"
                            disabled={index === draft.gallery.length - 1}
                            aria-label={'Move gallery item ' + (index + 1) + ' down'}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown size={16} />
                            Down
                          </Button>
                          <Button
                            type="button"
                            variant="soft"
                            color="red"
                            onClick={() =>
                              change(
                                'gallery',
                                draft.gallery.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <Trash2 size={16} />
                            Remove
                          </Button>
                        </Flex>
                      </div>
                    </li>
                  ))}
                </ol>
                <FileUpload
                  id="work-gallery-upload"
                  label={uploading ? 'Uploading…' : 'Add gallery media'}
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  busy={busy || draft.gallery.length >= 40}
                  onFile={(file) => void upload(file, 'gallery')}
                />
              </Card>
              <Card className="admin-form-panel">
                <h2>Custom link (optional)</h2>
                <p className="admin-field-help">
                  Provide both a button label and an HTTP or HTTPS URL, or leave both empty.
                </p>
                <Field id="work-link-label" label="Button label">
                  <TextField.Root
                    size="3"
                    id="work-link-label"
                    value={draft.linkLabel ?? ''}
                    maxLength={80}
                    required={!!draft.linkUrl}
                    onChange={(e) => change('linkLabel', e.target.value || null)}
                  />
                </Field>
                <Field id="work-link-url" label="Destination URL">
                  <TextField.Root
                    size="3"
                    id="work-link-url"
                    type="url"
                    placeholder="https://"
                    pattern="https?://.*"
                    value={draft.linkUrl ?? ''}
                    maxLength={2048}
                    required={!!draft.linkLabel}
                    onChange={(e) => change('linkUrl', e.target.value || null)}
                  />
                </Field>
              </Card>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
