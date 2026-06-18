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

export const AssetList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });
  return (
    <List>
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
              <EditButton hideText size="small" recordItemId={record.id} />
              <ShowButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};

const AssetFields = () => {
  const form = Form.useFormInstance();
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
    <Form.Item label="Type" name="type" rules={[{ required: true }]}>
      <Select options={ASSET_TYPES.map((t) => ({ value: t, label: t }))} />
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
    <Form.Item label="Preview Image" name="previews" valuePropName="fileList" getValueFromEvent={() => undefined} help="Upload gambar preview; URL preview otomatis terisi.">
      <Upload
        accept="image/*"
        maxCount={1}
        showUploadList={false}
        customRequest={async ({ file, onSuccess, onError }) => {
          try {
            const fd = new FormData();
            fd.append('file', file as File);
            const res = await fetch('/api/admin/uploads', {
              method: 'POST',
              credentials: 'include',
              body: fd,
            });
            if (!res.ok) throw new Error('upload gagal');
            const data = await res.json();
            form.setFieldValue('previews', [data.previewUrl]);
            form.setFieldValue('fileKey', data.fileKey);
            message.success('Upload berhasil');
            onSuccess?.(data);
          } catch (err) {
            message.error('Upload gagal');
            onError?.(err as Error);
          }
        }}
      >
        <Button icon={<UploadOutlined />}>Upload preview</Button>
      </Upload>
    </Form.Item>
    <Form.Item label="Popular" name="popular" valuePropName="checked" initialValue={false}>
      <Switch />
    </Form.Item>
  </>
  );
};

export const AssetCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <AssetFields />
      </Form>
    </Create>
  );
};

export const AssetEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <AssetFields />
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
    </Show>
  );
};
