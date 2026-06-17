import {
  List,
  useTable,
  EditButton,
  DeleteButton,
  Create,
  Edit,
  useForm,
} from '@refinedev/antd';
import { Table, Space, Tag, Form, Input, Select, InputNumber, Switch } from 'antd';

export const PlanList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });
  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" sorter />
        <Table.Column dataIndex="code" title="Code" />
        <Table.Column dataIndex="segment" title="Segment" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="cycle" title="Cycle" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="creditQuota" title="Credit Quota" />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};

const PlanFields = () => (
  <>
    <Form.Item label="Name" name="name" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Code" name="code" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Segment" name="segment" rules={[{ required: true }]}>
      <Select
        options={[
          { value: 'individual', label: 'individual' },
          { value: 'team', label: 'team' },
          { value: 'enterprise', label: 'enterprise' },
        ]}
      />
    </Form.Item>
    <Form.Item label="Cycle" name="cycle" rules={[{ required: true }]}>
      <Select
        options={[
          { value: 'monthly', label: 'monthly' },
          { value: 'yearly', label: 'yearly' },
        ]}
      />
    </Form.Item>
    <Form.Item label="Price IDR" name="priceIdr" initialValue="0">
      <Input />
    </Form.Item>
    <Form.Item label="Price USD" name="priceUsd" initialValue="0">
      <Input />
    </Form.Item>
    <Form.Item label="Credit Quota" name="creditQuota" initialValue={0}>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item label="Max Concurrent Sessions" name="maxConcurrentSessions">
      <InputNumber min={1} style={{ width: '100%' }} placeholder="kosong = unlimited" />
    </Form.Item>
    <Form.Item label="Scene 2D" name={['editorAccess', 'scene2d']} valuePropName="checked" initialValue={false}>
      <Switch />
    </Form.Item>
    <Form.Item label="Editor 3D" name={['editorAccess', 'editor3d']} valuePropName="checked" initialValue={false}>
      <Switch />
    </Form.Item>
    <Form.Item label="Pro Templates" name={['editorAccess', 'proTemplates']} valuePropName="checked" initialValue={false}>
      <Switch />
    </Form.Item>
    <Form.Item label="AI Video" name={['editorAccess', 'aiVideo']} valuePropName="checked" initialValue={false}>
      <Switch />
    </Form.Item>
    <Form.Item label="Commercial" name="commercial" valuePropName="checked" initialValue={false}>
      <Switch />
    </Form.Item>
  </>
);

export const PlanCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <PlanFields />
      </Form>
    </Create>
  );
};

export const PlanEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <PlanFields />
      </Form>
    </Edit>
  );
};
