import { List, useTable, ShowButton } from '@refinedev/antd';
import { useShow, useCreate, useList, useNotification } from '@refinedev/core';
import { Table, Space, Tag, Typography, Card, Descriptions, Form, Select, InputNumber, Button } from 'antd';
import { useParams } from 'react-router';

export const UserList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });
  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="email" title="Email" sorter />
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column
          dataIndex="role"
          title="Role"
          render={(v: string) => <Tag color={v === 'admin' ? 'volcano' : 'default'}>{v}</Tag>}
        />
        <Table.Column dataIndex="activePlan" title="Active Plan" render={(v: string) => v ?? '-'} />
        <Table.Column dataIndex="creditBalance" title="Credits" />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <ShowButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};

/** Form attach langganan manual ke user (POST /subscriptions). */
const AttachSubscription = ({ userId }: { userId: string }) => {
  const { mutate, isLoading } = useCreate();
  const { open } = useNotification();
  const { data: plansData } = useList({ resource: 'plans', pagination: { pageSize: 100 } });
  const [form] = Form.useForm();

  return (
    <Card title="Attach Subscription" size="small" style={{ marginTop: 16 }}>
      <Form
        form={form}
        layout="inline"
        onFinish={(values) =>
          mutate(
            { resource: 'subscriptions', values: { ...values, userId } },
            {
              onSuccess: () => {
                open?.({ type: 'success', message: 'Subscription attached' });
                form.resetFields();
              },
            },
          )
        }
      >
        <Form.Item name="planId" rules={[{ required: true }]}>
          <Select
            placeholder="Pilih plan"
            style={{ minWidth: 200 }}
            options={(plansData?.data ?? []).map((p) => ({ value: p.id, label: p.name as string }))}
          />
        </Form.Item>
        <Form.Item name="periodDays" initialValue={30}>
          <InputNumber min={1} addonAfter="hari" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isLoading}>
            Attach
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

/** Form tambah credit ledger entry manual (POST /credit-ledger). */
const AddCredit = ({ userId }: { userId: string }) => {
  const { mutate, isLoading } = useCreate();
  const { open } = useNotification();
  const [form] = Form.useForm();

  return (
    <Card title="Adjust Credit" size="small" style={{ marginTop: 16 }}>
      <Form
        form={form}
        layout="inline"
        onFinish={(values) =>
          mutate(
            { resource: 'credit-ledger', values: { ...values, userId, reason: 'admin_adjust' } },
            {
              onSuccess: () => {
                open?.({ type: 'success', message: 'Credit adjusted' });
                form.resetFields();
              },
            },
          )
        }
      >
        <Form.Item name="delta" rules={[{ required: true }]}>
          <InputNumber placeholder="delta (+/-)" style={{ minWidth: 160 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isLoading}>
            Apply
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export const UserShow = () => {
  const { id } = useParams();
  const { queryResult } = useShow();
  const record = queryResult?.data?.data;

  return (
    <div>
      <Card loading={queryResult?.isLoading} title="User">
        <Descriptions column={1}>
          <Descriptions.Item label="Email">{record?.email}</Descriptions.Item>
          <Descriptions.Item label="Name">{record?.name}</Descriptions.Item>
          <Descriptions.Item label="Role">{record?.role}</Descriptions.Item>
          <Descriptions.Item label="Active Plan">
            {record?.activePlan?.name ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Credit Balance">
            <Typography.Text strong>{record?.creditBalance ?? 0}</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
      {id && <AttachSubscription userId={id} />}
      {id && <AddCredit userId={id} />}
    </div>
  );
};
