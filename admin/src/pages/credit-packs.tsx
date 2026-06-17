import {
  List,
  useTable,
  EditButton,
  DeleteButton,
  Create,
  Edit,
  useForm,
} from '@refinedev/antd';
import { Table, Space, Form, Input, InputNumber, Switch, Tag } from 'antd';

export const CreditPackList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });
  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" sorter />
        <Table.Column dataIndex="code" title="Code" />
        <Table.Column dataIndex="credits" title="Credits" sorter />
        <Table.Column dataIndex="priceIdr" title="Price IDR" />
        <Table.Column
          dataIndex="enabled"
          title="Enabled"
          render={(v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'yes' : 'no'}</Tag>}
        />
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

const PackFields = () => (
  <>
    <Form.Item label="Name" name="name" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Code" name="code" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Credits" name="credits" rules={[{ required: true }]}>
      <InputNumber min={1} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item label="Price IDR" name="priceIdr" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Price USD" name="priceUsd" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Enabled" name="enabled" valuePropName="checked" initialValue={true}>
      <Switch />
    </Form.Item>
  </>
);

export const CreditPackCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <PackFields />
      </Form>
    </Create>
  );
};

export const CreditPackEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <PackFields />
      </Form>
    </Edit>
  );
};
