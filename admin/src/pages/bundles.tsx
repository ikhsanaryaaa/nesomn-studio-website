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
  useSelect,
} from '@refinedev/antd';
import { useShow } from '@refinedev/core';
import { Table, Space, Tag, Form, Input, Select, Typography } from 'antd';

export const BundleList = () => {
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

const BundleFields = () => {
  // Pilihan asset untuk mengisi bundle_items (dikirim ke PUT /bundles/:id/items).
  const { selectProps } = useSelect({
    resource: 'assets',
    optionLabel: 'title',
    optionValue: 'id',
  });
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
      <Form.Item label="Type" name="type" initialValue="preset">
        <Select
          options={[
            { value: 'preset', label: 'preset' },
            { value: 'custom', label: 'custom' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Assets dalam bundle" name="assetIds">
        <Select mode="multiple" {...selectProps} placeholder="Pilih aset" />
      </Form.Item>
    </>
  );
};

export const BundleCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <BundleFields />
      </Form>
    </Create>
  );
};

export const BundleEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <BundleFields />
      </Form>
    </Edit>
  );
};

export const BundleShow = () => {
  const { queryResult } = useShow();
  const record = queryResult?.data?.data;
  return (
    <Show isLoading={queryResult?.isLoading}>
      <Typography.Title level={5}>Title</Typography.Title>
      <Typography.Text>{record?.title}</Typography.Text>
      <Typography.Title level={5}>Assets</Typography.Title>
      <Typography.Text>{(record?.assetIds ?? []).join(', ') || '-'}</Typography.Text>
    </Show>
  );
};
