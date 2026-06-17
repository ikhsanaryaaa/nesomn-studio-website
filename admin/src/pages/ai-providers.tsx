import {
  List,
  useTable,
  EditButton,
  DeleteButton,
  Create,
  Edit,
  useForm,
} from '@refinedev/antd';
import { useCustomMutation, useNotification } from '@refinedev/core';
import { Table, Space, Tag, Form, Input, Select, InputNumber, Switch, Button } from 'antd';

const KINDS = [
  { value: 'image', label: 'image' },
  { value: 'video', label: 'video' },
];
const TABS = [
  { value: 'scene', label: 'scene' },
  { value: 'motion', label: 'motion' },
];

/** Tombol test koneksi provider (POST /ai-providers/:id/test). */
const TestButton = ({ id }: { id: string }) => {
  const { mutate, isLoading } = useCustomMutation();
  const { open } = useNotification();
  return (
    <Button
      size="small"
      loading={isLoading}
      onClick={() =>
        mutate(
          { url: `/api/admin/ai-providers/${id}/test`, method: 'post', values: {} },
          {
            onSuccess: (data) => {
              const res = data?.data as { ok: boolean; detail: string };
              open?.({
                type: res?.ok ? 'success' : 'error',
                message: res?.ok ? 'Koneksi OK' : 'Koneksi gagal',
                description: res?.detail,
              });
            },
          },
        )
      }
    >
      Test
    </Button>
  );
};

export const ProviderList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });
  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="key" title="Key" sorter />
        <Table.Column dataIndex="modelName" title="Model" />
        <Table.Column dataIndex="kind" title="Kind" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="tab" title="Tab" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="creditCost" title="Credit Cost" />
        <Table.Column
          dataIndex="hasApiKey"
          title="API Key"
          render={(v: boolean) => (v ? <Tag color="green">set ••••</Tag> : <Tag>none</Tag>)}
        />
        <Table.Column
          dataIndex="enabled"
          title="Enabled"
          render={(v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'yes' : 'no'}</Tag>}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <TestButton id={record.id} />
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};

const ProviderFields = ({ isEdit }: { isEdit?: boolean }) => (
  <>
    <Form.Item label="Key" name="key" rules={[{ required: true }]}>
      <Input placeholder="mis. kie-flux-image" />
    </Form.Item>
    <Form.Item label="Model Name" name="modelName" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Kind" name="kind" rules={[{ required: true }]}>
      <Select options={KINDS} />
    </Form.Item>
    <Form.Item label="Tab" name="tab" rules={[{ required: true }]}>
      <Select options={TABS} />
    </Form.Item>
    <Form.Item label="Base URL" name="baseUrl">
      <Input placeholder="https://api.kie.ai/..." />
    </Form.Item>
    <Form.Item
      label="API Key"
      name="apiKey"
      help={isEdit ? 'Kosongkan untuk mempertahankan key lama.' : 'Disimpan terenkripsi.'}
    >
      <Input.Password placeholder={isEdit ? '••••••••' : ''} />
    </Form.Item>
    <Form.Item label="Credit Cost" name="creditCost" initialValue={0}>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item label="Enabled" name="enabled" valuePropName="checked" initialValue={true}>
      <Switch />
    </Form.Item>
  </>
);

export const ProviderCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <ProviderFields />
      </Form>
    </Create>
  );
};

export const ProviderEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <ProviderFields isEdit />
      </Form>
    </Edit>
  );
};
