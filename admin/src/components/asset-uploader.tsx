import { useState } from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined, CheckCircleFilled } from '@ant-design/icons';

/**
 * Upload satu file ke endpoint admin; kembalikan JSON respons.
 * Kontrak endpoint (/api/admin/uploads?kind=preview|file) tidak diubah.
 */
export async function uploadTo(kind: 'preview' | 'file', file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/admin/uploads?kind=${kind}`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? 'upload gagal');
  }
  return res.json();
}

export interface AssetUploaderProps {
  /** Jenis upload untuk endpoint (preview image atau file produk). */
  kind: 'preview' | 'file';
  /** Atribut accept input file. */
  accept?: string;
  /** Judul area dropzone. */
  title: string;
  /** Hint format/ukuran di bawah judul. */
  hint?: string;
  /** Label file yang sudah tersimpan (state ter-upload), bila ada. */
  savedLabel?: string;
  /** Dipanggil dengan JSON respons upload saat sukses. */
  onUploaded: (data: { previewUrl?: string; fileKey?: string }) => void;
  /** Pesan sukses toast. */
  successMessage?: string;
  /** Nonaktifkan uploader (mis. Type belum dipilih). */
  disabled?: boolean;
}

/**
 * Dropzone upload reusable selaras DESIGN.md 6.5.
 * Mendukung drag-and-drop + klik, menampilkan hint & state ter-upload.
 */
export const AssetUploader = ({
  kind,
  accept,
  title,
  hint,
  savedLabel,
  onUploaded,
  successMessage = 'File ter-upload',
  disabled,
}: AssetUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [doneName, setDoneName] = useState<string | null>(null);

  const done = Boolean(doneName ?? savedLabel);

  return (
    <div className={`nsm-uploader${done ? ' nsm-uploader-done' : ''}`}>
      <Upload.Dragger
        accept={accept}
        maxCount={1}
        showUploadList={false}
        disabled={disabled}
        customRequest={async ({ file, onSuccess, onError }) => {
          setUploading(true);
          try {
            const data = await uploadTo(kind, file as File);
            onUploaded(data);
            setDoneName((file as File).name);
            message.success(successMessage);
            onSuccess?.(data);
          } catch (err) {
            message.error((err as Error).message);
            onError?.(err as Error);
          } finally {
            setUploading(false);
          }
        }}
      >
        <div className="nsm-uploader-body">
          <span className="nsm-uploader-icon">
            {done ? <CheckCircleFilled /> : <InboxOutlined />}
          </span>
          <span className="nsm-uploader-title">
            {uploading ? 'Mengunggah...' : title}
          </span>
          {done ? (
            <span className="nsm-uploader-file">
              {doneName ?? savedLabel}
            </span>
          ) : (
            hint && <span className="nsm-uploader-hint">{hint}</span>
          )}
        </div>
      </Upload.Dragger>
    </div>
  );
};
