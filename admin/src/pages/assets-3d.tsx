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
  Row,
  Col,
  Card,
  Divider,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';

/**
 * CRUD admin aset 3D (editorType=product_3d_editor).
 * Resource TERPISAH (`assets-3d`) dengan route, form, dan table sendiri.
 * Tidak berbagi dengan aset Scene. Tipe: mockup3d, asset3d.
 */

const TYPE_3D = [
  { value: 'mockup3d', label: 'mockup3d' },
  { value: 'asset3d', label: 'asset3d' },
];

const RESOURCE = 'assets-3d';

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

export const Asset3dList = () => {
  const { tableProps } = useTable({ resource: RESOURCE, syncWithLocation: false });
  return (
    <List title="Assets 3D" resource={RESOURCE}>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="title" title="Title" sorter />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column dataIndex="type" title="Type" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(v: string) => (
            <Tag color={v === 'published' ? 'green' : v === 'archived' ? 'default' : 'orange'}>{v}</Tag>
          )}
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
              <EditButton hideText size="small" recordItemId={record.id} resource={RESOURCE} />
              <ShowButton hideText size="small" recordItemId={record.id} resource={RESOURCE} />
              <DeleteButton hideText size="small" recordItemId={record.id} resource={RESOURCE} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};

const Asset3dFields = () => {
  const form = Form.useFormInstance();
  const previews = Form.useWatch('previews', form) as string[] | undefined;
  const fileKey = Form.useWatch('fileKey', form) as string | undefined;
  const glbFile = Form.useWatch('glbFile', form) as string | undefined;

  return (
    <>
      <Form.Item label="Title" name="title" rules={[{ required: true }]}>
        <Input placeholder="Nama aset 3D" />
      </Form.Item>
      <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
        <Input placeholder="contoh: hoodie-3d-mockup" />
      </Form.Item>
      <Form.Item label="Description" name="description">
        <Input.TextArea rows={3} placeholder="Deskripsi singkat aset" />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Type" name="type" rules={[{ required: true }]}>
            <Select options={TYPE_3D} placeholder="Pilih tipe 3D" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Tier" name="tier" initialValue="free">
            <Select
              options={[
                { value: 'free', label: 'free' },
                { value: 'pro', label: 'pro' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Category" name="category">
            <Input placeholder="mis. mockup" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Version" name="version" initialValue="1.0.0">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Status" name="status" initialValue="draft">
            <Select
              options={[
                { value: 'draft', label: 'draft' },
                { value: 'published', label: 'published' },
                { value: 'archived', label: 'archived' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Price IDR" name="priceIdr" initialValue="0">
            <Input addonBefore="Rp" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Price USD" name="priceUsd" initialValue="0">
            <Input addonBefore="$" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Marketplace (one-time purchase)" name="isMarketplace" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Subscription Asset" name="isSubscriptionAsset" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      {/* Field tersembunyi: diisi uploader, ikut tersimpan saat Save. */}
      <Form.Item name="previews" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="fileKey" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="glbFile" hidden>
        <Input />
      </Form.Item>

      <Card size="small" title="Files & Media" style={{ marginBottom: 24 }}>
        <Form.Item label="Preview Image" help="Gambar yang tampil di storefront." style={{ marginBottom: 16 }}>
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
            <Button icon={<UploadOutlined />} type={previews?.length ? 'default' : 'primary'} ghost={!previews?.length}>
              {previews?.length ? 'Ganti preview' : 'Upload preview'}
            </Button>
          </Upload>
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        <Form.Item
          label="3D Model (GLB/GLTF)"
          style={{ marginBottom: 0 }}
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
                form.setFieldValue('fileKey', data.fileKey);
                message.success('Model 3D ter-upload');
                onSuccess?.(data);
              } catch (err) {
                message.error((err as Error).message);
                onError?.(err as Error);
              }
            }}
          >
            <Button icon={<UploadOutlined />} type={glbFile ? 'default' : 'primary'} ghost={!glbFile}>
              {glbFile ?? fileKey ? 'Ganti GLB' : 'Upload GLB'}
            </Button>
          </Upload>
        </Form.Item>
      </Card>

      <Form.Item label="Popular" name="popular" valuePropName="checked" initialValue={false}>
        <Switch />
      </Form.Item>
    </>
  );
};

export const Asset3dCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: RESOURCE, action: 'create' });
  return (
    <Create saveButtonProps={saveButtonProps} resource={RESOURCE}>
      <Form {...formProps} layout="vertical">
        <Asset3dFields />
      </Form>
    </Create>
  );
};

export const Asset3dEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: RESOURCE, action: 'edit' });
  return (
    <Edit saveButtonProps={saveButtonProps} resource={RESOURCE}>
      <Form {...formProps} layout="vertical">
        <Asset3dFields />
      </Form>
    </Edit>
  );
};

export const Asset3dShow = () => {
  const { queryResult } = useShow({ resource: RESOURCE });
  const record = queryResult?.data?.data;
  return (
    <Show isLoading={queryResult?.isLoading}>
      <Typography.Title level={5}>Title</Typography.Title>
      <Typography.Text>{record?.title}</Typography.Text>
      <Typography.Title level={5}>Slug</Typography.Title>
      <Typography.Text>{record?.slug}</Typography.Text>
      <Typography.Title level={5}>Type</Typography.Title>
      <Typography.Text>{record?.type ?? '-'}</Typography.Text>
      <Typography.Title level={5}>3D Model</Typography.Title>
      <Typography.Text>{record?.glbFile ?? '-'}</Typography.Text>
    </Show>
  );
};
