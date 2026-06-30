import {
  List,
  useTable,
  EditButton,
  ShowButton,
  DeleteButton,
  Create,
  Edit,
  Show,
  useForm,
} from '@refinedev/antd';
import { useShow } from '@refinedev/core';
import {
  Table,
  Space,
  Tag,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  Upload,
  Button,
  message,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const ASSET_TYPES = ['font', 'mockup3d', 'mockup2d', 'asset3d', 'graphic', 'motion'];

export const AssetList = ({ types, title }: { types?: string[]; title?: string }) => {
  // Semua varian tab memakai satu endpoint API `assets`; pembeda hanya filter type.
  // Backend menerima `?type=a,b` (comma-separated), jadi kirim sebagai satu filter eq.
  const { tableProps } = useTable({
    resource: 'assets',
    syncWithLocation: false,
    permanentFilter: types?.length
      ? [{ field: 'type', operator: 'eq', value: types.join(',') }]
      : [],
  });
  return (
    <List title={title} resource="assets">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="title" title="Title" sorter />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column
          dataIndex="type"
          title="Type"
          render={(v: string) => <Tag>{v}</Tag>}
        />
        <Table.Column
          dataIndex="tier"
          title="Tier"
          render={(v: string) => <Tag color={v === 'pro' ? 'gold' : 'default'}>{v}</Tag>}
        />
        <Table.Column dataIndex="priceIdr" title="Price IDR" />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} resource="assets" />
              <ShowButton hideText size="small" recordItemId={record.id} resource="assets" />
              <DeleteButton hideText size="small" recordItemId={record.id} resource="assets" />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};

// accept attribute file produk berdasarkan tipe aset terpilih.
const FILE_ACCEPT: Record<string, string> = {
  mockup2d: 'image/*',
  mockup3d: '.glb,.gltf,model/gltf-binary,model/gltf+json',
  asset3d: '.glb,.gltf,model/gltf-binary,model/gltf+json',
  font: '.zip,.otf,.ttf,font/otf,font/ttf,application/zip',
  graphic: '.zip,.svg,image/svg+xml,image/png,application/zip',
  motion: '.zip,.mp4,.webm,video/mp4,video/webm,application/zip',
};

/** Upload satu file ke endpoint admin; kembalikan JSON respons. */
async function uploadTo(kind: 'preview' | 'file', file: File) {
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

const AssetFields = ({ allowedTypes }: { allowedTypes?: string[] }) => {
  const form = Form.useFormInstance();
  const type = Form.useWatch('type', form) as string | undefined;
  const fileKey = Form.useWatch('fileKey', form) as string | undefined;
  const glbFile = Form.useWatch('glbFile', form) as string | undefined;
  const is3d = type === 'mockup3d' || type === 'asset3d';
  const typeOptions = (allowedTypes?.length ? allowedTypes : ASSET_TYPES).map((t) => ({
    value: t,
    label: t,
  }));

  return (
    <>
      <Form.Item label="Title" name="title" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item label="Description" name="description">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item
        label="Type"
        name="type"
        rules={[{ required: true }]}
        initialValue={allowedTypes?.length === 1 ? allowedTypes[0] : undefined}
      >
        <Select options={typeOptions} />
      </Form.Item>
      <Form.Item label="Tier" name="tier" initialValue="free">
        <Select
          options={[
            { value: 'free', label: 'free' },
            { value: 'pro', label: 'pro' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Price IDR" name="priceIdr" initialValue="0">
        <Input />
      </Form.Item>
      <Form.Item label="Price USD" name="priceUsd" initialValue="0">
        <Input />
      </Form.Item>

      {/* Field tersembunyi: nilai diisi oleh uploader, ikut tersimpan saat Save. */}
      <Form.Item name="previews" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="fileKey" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="glbFile" hidden>
        <Input />
      </Form.Item>

      {/* Gambar preview untuk storefront (selalu gambar). */}
      <Form.Item label="Preview Image" help="Gambar yang tampil di storefront.">
        <Upload
          accept="image/*"
          maxCount={1}
          showUploadList={false}
          customRequest={async ({ file, onSuccess, onError }) => {
            try {
              const data = await uploadTo('preview', file as File);
              form.setFieldValue('previews', [data.previewUrl]);
              message.success('Preview ter-upload');
              onSuccess?.(data);
            } catch (err) {
              message.error((err as Error).message);
              onError?.(err as Error);
            }
          }}
        >
          <Button icon={<UploadOutlined />}>Upload preview</Button>
        </Upload>
      </Form.Item>

      {/* File produk yang dijual (accept menyesuaikan tipe). */}
      <Form.Item
        label="Asset File (file yang dijual)"
        help={
          fileKey
            ? `Tersimpan: ${fileKey}`
            : 'File produk yang diunduh pembeli. Pilih Type dulu agar format sesuai.'
        }
      >
        <Upload
          accept={type ? (FILE_ACCEPT[type] ?? '*') : '*'}
          maxCount={1}
          showUploadList={false}
          customRequest={async ({ file, onSuccess, onError }) => {
            try {
              const data = await uploadTo('file', file as File);
              form.setFieldValue('fileKey', data.fileKey);
              message.success('File aset ter-upload');
              onSuccess?.(data);
            } catch (err) {
              message.error((err as Error).message);
              onError?.(err as Error);
            }
          }}
        >
          <Button icon={<UploadOutlined />}>Upload asset file</Button>
        </Upload>
      </Form.Item>

      {/* Model 3D (GLB/GLTF) hanya untuk tipe 3D. */}
      {is3d && (
        <Form.Item
          label="3D Model (GLB/GLTF)"
          help={glbFile ? `Tersimpan: ${glbFile}` : 'Model 3D untuk viewer/editor.'}
        >
          <Upload
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            maxCount={1}
            showUploadList={false}
            customRequest={async ({ file, onSuccess, onError }) => {
              try {
                const data = await uploadTo('file', file as File);
                form.setFieldValue('glbFile', data.fileKey);
                message.success('Model 3D ter-upload');
                onSuccess?.(data);
              } catch (err) {
                message.error((err as Error).message);
                onError?.(err as Error);
              }
            }}
          >
            <Button icon={<UploadOutlined />}>Upload GLB</Button>
          </Upload>
        </Form.Item>
      )}

      <Form.Item label="Popular" name="popular" valuePropName="checked" initialValue={false}>
        <Switch />
      </Form.Item>
    </>
  );
};

export const AssetCreate = ({ allowedTypes }: { allowedTypes?: string[] }) => {
  const { formProps, saveButtonProps } = useForm({ resource: 'assets', action: 'create' });
  return (
    <Create saveButtonProps={saveButtonProps} resource="assets">
      <Form {...formProps} layout="vertical">
        <AssetFields allowedTypes={allowedTypes} />
      </Form>
    </Create>
  );
};

export const AssetEdit = ({ allowedTypes }: { allowedTypes?: string[] }) => {
  const { formProps, saveButtonProps } = useForm({ resource: 'assets', action: 'edit' });
  return (
    <Edit saveButtonProps={saveButtonProps} resource="assets">
      <Form {...formProps} layout="vertical">
        <AssetFields allowedTypes={allowedTypes} />
      </Form>
    </Edit>
  );
};

export const AssetShow = () => {
  const { queryResult } = useShow();
  const record = queryResult?.data?.data;
  return (
    <Show isLoading={queryResult?.isLoading}>
      <Typography.Title level={5}>Title</Typography.Title>
      <Typography.Text>{record?.title}</Typography.Text>
      <Typography.Title level={5}>Slug</Typography.Title>
      <Typography.Text>{record?.slug}</Typography.Text>
      <Typography.Title level={5}>Description</Typography.Title>
      <Typography.Text>{record?.description ?? '-'}</Typography.Text>
      <Typography.Title level={5}>Type</Typography.Title>
      <Typography.Text>{record?.type ?? '-'}</Typography.Text>
      <Typography.Title level={5}>Asset File</Typography.Title>
      <Typography.Text>{record?.fileKey ?? '-'}</Typography.Text>
      <Typography.Title level={5}>3D Model</Typography.Title>
      <Typography.Text>{record?.glbFile ?? '-'}</Typography.Text>
    </Show>
  );
};
