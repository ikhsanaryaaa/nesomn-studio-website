import { List, useTable } from '@refinedev/antd';
import { Alert, Button, Table, Tag } from 'antd';

/** Read-only operational records. Financial mutations remain in audited API workflows. */
export function SubscriptionList() {
  const { tableProps, tableQuery } = useTable({
    resource: 'subscriptions',
    syncWithLocation: true,
  });
  return (
    <List title="Subscriptions" canCreate={false}>
      <p>
        Billing periods and statuses come from the server. Cancellation may leave access available
        until the current period ends.
      </p>
      {tableQuery.isError && (
        <Alert
          type="error"
          message="Unable to load subscriptions"
          action={<Button onClick={() => void tableQuery.refetch()}>Try again</Button>}
        />
      )}
      <Table {...tableProps} rowKey="id" scroll={{ x: 1000 }}>
        <Table.Column dataIndex="userId" title="User ID" />
        <Table.Column dataIndex="planId" title="Plan ID" />
        <Table.Column dataIndex="status" title="Status" render={(v) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="gateway" title="Provider" />
        <Table.Column dataIndex="currentPeriodStart" title="Starts" />
        <Table.Column dataIndex="currentPeriodEnd" title="Ends" />
      </Table>
    </List>
  );
}

export function CreditLedgerList() {
  const { tableProps, tableQuery } = useTable({
    resource: 'credit-ledger',
    syncWithLocation: true,
  });
  return (
    <List title="Credit ledger" canCreate={false}>
      <p>
        Credit transaction history from the server. This page does not change balances or payment
        statuses.
      </p>
      {tableQuery.isError && (
        <Alert
          type="error"
          message="Unable to load the ledger"
          action={<Button onClick={() => void tableQuery.refetch()}>Try again</Button>}
        />
      )}
      <Table {...tableProps} rowKey="id" scroll={{ x: 1100 }}>
        <Table.Column dataIndex="userId" title="User ID" />
        <Table.Column dataIndex="delta" title="Change" />
        <Table.Column dataIndex="balanceAfter" title="Balance after" />
        <Table.Column dataIndex="reason" title="Reason" />
        <Table.Column dataIndex="refId" title="Reference" />
        <Table.Column dataIndex="createdAt" title="Time" />
      </Table>
    </List>
  );
}
