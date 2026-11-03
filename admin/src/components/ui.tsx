import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useState,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  Badge,
  Button as RadixButton,
  Callout,
  Card as RadixCard,
  Checkbox,
  Flex,
  Select as RadixSelect,
  Spinner,
  Switch as RadixSwitch,
  Table as RadixTable,
  TextArea,
  TextField,
} from '@radix-ui/themes';
import {
  useTable as useCoreTable,
  useForm as useCoreForm,
  useSelect as useCoreSelect,
  useResource,
  useNavigation,
  useDelete,
  useWarnAboutChange,
} from '@refinedev/core';

// Presentation bridge for the existing Refine domain pages. All rendered controls are Radix.
// Refine exposes heterogeneous resource records; the field schema remains validated by each page and API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldValue = any;
type Props = { children?: ReactNode; [key: string]: FieldValue };
type Values = Record<string, FieldValue>;
const NoticeContext = createContext<(text: string, error?: boolean) => void>(() => {});
let notify: (text: string, error?: boolean) => void = () => {};
export const message = {
  success: (text: string) => notify(text),
  error: (text: string) => notify(text, true),
};
export function Notifications({ children }: Props) {
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  notify = (text, error) => setNotice({ text, error });
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {notice && (
        <div className="admin-notification" role={notice.error ? 'alert' : 'status'}>
          <Callout.Root color={notice.error ? 'red' : 'orange'}>
            <Callout.Text>{notice.text}</Callout.Text>
          </Callout.Root>
          <RadixButton variant="ghost" onClick={() => setNotice(undefined)}>
            Dismiss
          </RadixButton>
        </div>
      )}
    </NoticeContext.Provider>
  );
}
export const notificationProvider = {
  open: ({ message: text, description, type }: FieldValue) =>
    notify([text, description].filter(Boolean).join(': '), type === 'error'),
  close: () => {},
};
export function Button({ children, type, htmlType, loading, size, icon, ghost, ...props }: Props) {
  return (
    <RadixButton
      {...props}
      type={htmlType ?? 'button'}
      size={size === 'small' ? '2' : '3'}
      variant={type === 'primary' ? 'solid' : ghost ? 'outline' : 'soft'}
      disabled={props.disabled || loading}
    >
      {loading && <Spinner />}
      {icon}
      {children}
    </RadixButton>
  );
}
export function Alert({ message: text, action, type }: Props) {
  return (
    <Callout.Root
      color={type === 'error' ? 'red' : 'orange'}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <Callout.Text>{text}</Callout.Text>
      {action}
    </Callout.Root>
  );
}
export const Tag = ({ children, color }: Props) => (
  <Badge
    radius="full"
    color={
      color === 'red'
        ? 'red'
        : color === 'green'
          ? 'green'
          : color === 'default'
            ? 'gray'
            : 'orange'
    }
  >
    {children}
  </Badge>
);
export const Space = ({ children }: Props) => (
  <Flex gap="2" align="center" wrap="wrap">
    {children}
  </Flex>
);
export const Row = ({ children }: Props) => <div className="admin-field-row">{children}</div>;
export const Col = ({ children }: Props) => <div>{children}</div>;
export const Divider = (props: Props) => <hr className="admin-divider" style={props.style} />;
export const Card = ({ children, title, loading, style }: Props) => (
  <RadixCard className="admin-panel" style={style}>
    <h2>{title}</h2>
    {loading ? <Spinner /> : children}
  </RadixCard>
);
export const Typography = {
  Title: ({ children }: Props) => <h2 className="admin-detail-label">{children}</h2>,
  Text: ({ children, strong }: Props) =>
    strong ? <strong>{children}</strong> : <span>{children ?? '—'}</span>,
};
export const Descriptions = Object.assign(
  ({ children }: Props) => <dl className="admin-descriptions">{children}</dl>,
  {
    Item: ({ children, label }: Props) => (
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    ),
  },
);
export function List({ children, title, resource: name, canCreate = true }: Props) {
  const { resource } = useResource(name);
  const navigation = useNavigation();
  return (
    <section className="admin-page">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Workspace management</p>
          <h1>{title ?? resource?.meta?.label ?? 'Records'}</h1>
        </div>
        {canCreate && resource?.create && (
          <Button type="primary" onClick={() => navigation.create(resource.name)}>
            Create new
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}
export function useTable(options: FieldValue = {}) {
  const table = useCoreTable(options);
  return {
    tableQuery: table.tableQueryResult,
    tableProps: {
      dataSource: table.tableQueryResult.data?.data ?? [],
      loading: table.tableQueryResult.isLoading,
      error: table.tableQueryResult.isError,
      refetch: table.tableQueryResult.refetch,
      current: table.current,
      pageSize: table.pageSize,
      total: table.tableQueryResult.data?.total ?? 0,
      onPage: table.setCurrent,
      sorters: table.sorters,
      onSort: table.setSorters,
    },
  };
}
type ColumnProps = {
  dataIndex?: string;
  title: string;
  sorter?: boolean;
  render?: (value: FieldValue, record: FieldValue) => ReactNode;
};
const Column = (props: ColumnProps) => {
  void props;
  return null;
};
function DataTable({
  children,
  dataSource = [],
  loading,
  error,
  refetch,
  current = 1,
  pageSize = 10,
  total = 0,
  onPage,
  sorters = [],
  onSort,
}: Props) {
  const columns = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => (child as ReactElement<ColumnProps>).props);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-data-panel">
      {error && (
        <Alert
          type="error"
          message="Unable to load records."
          action={<Button onClick={() => refetch?.()}>Try again</Button>}
        />
      )}
      <div className="admin-table-scroll" aria-busy={loading}>
        <RadixTable.Root variant="surface">
          <RadixTable.Header>
            <RadixTable.Row>
              {columns.map((column, i) => (
                <RadixTable.ColumnHeaderCell
                  key={i}
                  aria-sort={
                    column.sorter
                      ? sorters[0]?.field === column.dataIndex
                        ? sorters[0]?.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                >
                  {column.sorter ? (
                    <button
                      className="admin-sort"
                      onClick={() =>
                        onSort?.([
                          {
                            field: column.dataIndex,
                            order:
                              sorters[0]?.field === column.dataIndex && sorters[0]?.order === 'asc'
                                ? 'desc'
                                : 'asc',
                          },
                        ])
                      }
                    >
                      {column.title}{' '}
                      <span aria-hidden="true">
                        {sorters[0]?.field === column.dataIndex
                          ? sorters[0]?.order === 'asc'
                            ? '↑'
                            : '↓'
                          : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.title
                  )}
                </RadixTable.ColumnHeaderCell>
              ))}
            </RadixTable.Row>
          </RadixTable.Header>
          <RadixTable.Body>
            {dataSource.map((record: Values) => (
              <RadixTable.Row key={record.id}>
                {columns.map((column, i) => (
                  <RadixTable.Cell key={i}>
                    {column.render
                      ? column.render(
                          column.dataIndex ? record[column.dataIndex] : undefined,
                          record,
                        )
                      : String(record[column.dataIndex ?? ''] ?? '—')}
                  </RadixTable.Cell>
                ))}
              </RadixTable.Row>
            ))}
          </RadixTable.Body>
        </RadixTable.Root>
      </div>
      {loading && (
        <div className="admin-empty" role="status">
          <Spinner /> Loading records…
        </div>
      )}
      {!loading && !error && !dataSource.length && (
        <div className="admin-empty">No records yet.</div>
      )}
      <footer className="admin-pagination">
        <span>
          {total} records · Page {current} of {pages}
        </span>
        <Space>
          <Button disabled={loading || current <= 1} onClick={() => onPage?.(current - 1)}>
            Previous
          </Button>
          <Button disabled={loading || current >= pages} onClick={() => onPage?.(current + 1)}>
            Next
          </Button>
        </Space>
      </footer>
    </div>
  );
}
export const Table = Object.assign(DataTable, { Column });
function RecordButton({ recordItemId, resource: name, mode, children }: Props) {
  const { resource } = useResource(name);
  const nav = useNavigation();
  return (
    <Button
      onClick={() =>
        mode === 'edit'
          ? nav.edit(resource!.name, recordItemId)
          : nav.show(resource!.name, recordItemId)
      }
    >
      {children ?? (mode === 'edit' ? 'Edit' : 'View')}
    </Button>
  );
}
export const EditButton = (props: Props) => <RecordButton {...props} mode="edit" />;
export const ShowButton = (props: Props) => <RecordButton {...props} mode="show" />;
export function DeleteButton({
  recordItemId,
  resource: name,
  confirmTitle = 'Delete this record?',
  confirmOkText = 'Delete',
}: Props) {
  const { resource } = useResource(name);
  const { mutate, isLoading } = useDelete();
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger>
        <RadixButton variant="soft" color="red">
          {confirmOkText === 'Revoke' ? 'Revoke' : 'Delete'}
        </RadixButton>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="440px">
        <AlertDialog.Title>{confirmTitle}</AlertDialog.Title>
        <AlertDialog.Description>
          This action changes the record on the server. Review your selection before continuing.
        </AlertDialog.Description>
        <Flex justify="end" gap="3" mt="5">
          <AlertDialog.Cancel>
            <RadixButton variant="soft" color="gray" disabled={isLoading}>
              Cancel
            </RadixButton>
          </AlertDialog.Cancel>
          <RadixButton
            color="red"
            loading={isLoading}
            onClick={() =>
              mutate(
                { resource: resource!.name, id: recordItemId },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {confirmOkText}
          </RadixButton>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

type FormState = {
  values: Values;
  setFieldValue: (name: string | string[], value: FieldValue) => void;
  resetFields: () => void;
  registerField?: (name: string | string[]) => () => void;
};
const FormContext = createContext<FormState | null>(null);
function getValue(values: Values, name: string | string[]): FieldValue {
  return (Array.isArray(name) ? name : [name]).reduce((value, key) => value?.[key], values);
}
function useFormState(initialValues: Values = {}) {
  const { setWarnWhen } = useWarnAboutChange();
  const [values, setValues] = useState<Values>(initialValues);
  return {
    values,
    setValues,
    setFieldValue: (name: string | string[], value: FieldValue) =>
      setValues((old) => {
        const copy = structuredClone(old);
        const keys = Array.isArray(name) ? name : [name];
        let target = copy;
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        target[keys[keys.length - 1]!] = value;
        return copy;
      }),
    resetFields: () => {
      setValues(initialValues);
      setWarnWhen(false);
    },
  };
}
function AdminForm({
  children,
  form: externalForm,
  initialValues,
  onFinish,
  id,
  layout,
}: Props & { onFinish?: (values: Values) => void }) {
  const { setWarnWhen } = useWarnAboutChange();
  const own = useFormState(initialValues);
  const form = externalForm ?? own;
  const fields = useRef(new Map<string, string | string[]>());
  const registerField = (name: string | string[]) => {
    const key = JSON.stringify(name);
    fields.current.set(key, name);
    return () => {
      fields.current.delete(key);
    };
  };
  useEffect(() => {
    if (initialValues && !externalForm) own.setValues(initialValues);
  }, [initialValues]);
  return (
    <FormContext.Provider value={{ ...form, registerField }}>
      <form
        id={id}
        className={layout === 'inline' ? 'admin-form admin-inline-form' : 'admin-form'}
        onChangeCapture={() => setWarnWhen(true)}
        onSubmit={(e) => {
          e.preventDefault();
          const submitted: Values = {};
          for (const name of fields.current.values()) {
            const value = getValue(form.values, name);
            if (value === undefined) continue;
            const keys = Array.isArray(name) ? name : [name];
            let target = submitted;
            for (const key of keys.slice(0, -1)) target = target[key] ??= {};
            target[keys[keys.length - 1]!] = value;
          }
          onFinish?.(submitted);
        }}
      >
        {children}
      </form>
    </FormContext.Provider>
  );
}
function FormItem({
  children,
  label,
  name,
  initialValue,
  rules,
  valuePropName,
  hidden,
  help,
  style,
}: Props) {
  const form = useContext(FormContext)!;
  const generatedId = useId();
  const id = name ? (Array.isArray(name) ? name.join('_') : name) : generatedId;
  const required = rules?.some((rule: FieldValue) => rule.required);
  const value = name ? getValue(form.values, name) : undefined;
  useEffect(() => (name ? form.registerField?.(name) : undefined), []);
  useEffect(() => {
    if (name && value === undefined && initialValue !== undefined)
      form.setFieldValue(name, initialValue);
  }, []);
  const field =
    name && isValidElement(children)
      ? cloneElement(children as ReactElement<FieldValue>, {
          id,
          name: Array.isArray(name) ? name.join('.') : name,
          required,
          'aria-label': label ?? (children.props as FieldValue).placeholder ?? String(name),
          [valuePropName === 'checked' ? 'checked' : 'value']:
            value ?? initialValue ?? (valuePropName === 'checked' ? false : ''),
          onChange: (event: FieldValue) => {
            const next = event?.target
              ? valuePropName === 'checked'
                ? event.target.checked
                : event.target.value
              : event;
            form.setFieldValue(name, next);
          },
        })
      : children;
  return (
    <div className="admin-field" hidden={hidden} style={style}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {field}
      {help && <p className="admin-field-help">{help}</p>}
    </div>
  );
}
export const Form = Object.assign(AdminForm, {
  Item: FormItem,
  useFormInstance: () => useContext(FormContext)!,
  useWatch: (name: string, form: FormState) => getValue(form.values, name),
  useForm: () => [useFormState()] as const,
});
export function useForm(options: FieldValue = {}) {
  const core = useCoreForm(options);
  const id = useId();
  const [error, setError] = useState('');
  return {
    formProps: {
      id,
      initialValues: core.queryResult?.data?.data,
      onFinish: async (values: Values) => {
        setError('');
        try {
          await core.onFinish(values);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Unable to save changes.');
        }
      },
    },
    saveButtonProps: {
      form: id,
      htmlType: 'submit',
      loading: core.formLoading,
      disabled: core.queryResult?.isError,
      error,
      loadError: core.queryResult?.isError,
      retry: core.queryResult?.refetch,
    },
  };
}
function FormPage({ children, saveButtonProps, resource: name, action }: Props) {
  const { error, loadError, retry, ...buttonProps } = saveButtonProps ?? {};
  const { resource } = useResource(name);
  const nav = useNavigation();
  return (
    <section className="admin-page">
      <header className="admin-page-heading">
        <div>
          <button className="admin-back" onClick={() => nav.list(resource!.name)}>
            ← Back to {resource?.meta?.label ?? 'list'}
          </button>
          <h1>
            {action} {resource?.meta?.label ?? 'record'}
          </h1>
        </div>
        <Button type="primary" {...buttonProps}>
          Save changes
        </Button>
      </header>
      {error && <Alert type="error" message={error} />}
      {loadError && (
        <Alert
          type="error"
          message="Unable to load this record."
          action={<Button onClick={() => retry?.()}>Try again</Button>}
        />
      )}
      {!loadError && <RadixCard className="admin-form-panel">{children}</RadixCard>}
    </section>
  );
}
export const Create = (props: Props) => <FormPage {...props} action="Create" />;
export const Edit = (props: Props) => <FormPage {...props} action="Edit" />;
export function Show({ children, isLoading, isError, refetch }: Props) {
  const { resource } = useResource();
  const nav = useNavigation();
  return (
    <section className="admin-page">
      <header className="admin-page-heading">
        <div>
          <button className="admin-back" onClick={() => nav.list(resource!.name)}>
            ← Back to {resource?.meta?.label ?? 'list'}
          </button>
          <h1>{resource?.meta?.label ?? 'Record'} details</h1>
        </div>
      </header>
      {isError ? (
        <Alert
          type="error"
          message="Unable to load this record."
          action={<Button onClick={() => refetch?.()}>Try again</Button>}
        />
      ) : (
        <RadixCard className="admin-form-panel">{isLoading ? <Spinner /> : children}</RadixCard>
      )}
    </section>
  );
}

function TextInput({ addonBefore, addonAfter, ...props }: Props) {
  return (
    <TextField.Root {...props} size="3">
      {addonBefore && <TextField.Slot>{addonBefore}</TextField.Slot>}
      {addonAfter && <TextField.Slot side="right">{addonAfter}</TextField.Slot>}
    </TextField.Root>
  );
}
export const Input = Object.assign(TextInput, {
  TextArea: (props: Props) => <TextArea {...props} size="3" />,
  Password: (props: Props) => <TextInput {...props} type="password" autoComplete="new-password" />,
});
export function InputNumber({
  onChange,
  addonAfter,
  ...props
}: Props & { onChange?: (value: number | null) => void }) {
  return (
    <TextInput
      {...props}
      type="number"
      addonAfter={addonAfter}
      onChange={(event: FieldValue) =>
        onChange?.(event.target.value === '' ? null : Number(event.target.value))
      }
    />
  );
}
export function Switch({ onChange, checked, ...props }: Props) {
  return (
    <RadixSwitch
      className="admin-switch"
      {...props}
      checked={!!checked}
      onCheckedChange={onChange}
      size="3"
    />
  );
}
export function Select({
  options = [],
  value,
  defaultValue,
  onChange,
  placeholder = 'Select an option',
  mode,
  maxCount = 200,
  ...props
}: Props) {
  if (mode === 'multiple')
    return (
      <div
        className="admin-multiselect"
        role="group"
        aria-label={props['aria-label'] ?? placeholder}
      >
        {options.map((option: FieldValue) => (
          <label key={option.value}>
            <Checkbox
              checked={Array.isArray(value) && value.includes(option.value)}
              onCheckedChange={(checked) => {
                const list = Array.isArray(value) ? value : [];
                if (!checked) onChange?.(list.filter((item: string) => item !== option.value));
                else if (list.length < maxCount) onChange?.([...list, option.value]);
              }}
            />
            {option.label}
          </label>
        ))}
        {!options.length && <p>No options available.</p>}
      </div>
    );
  return (
    <RadixSelect.Root
      value={value === '' || value == null ? undefined : String(value)}
      defaultValue={defaultValue}
      onValueChange={onChange}
      required={props.required}
      name={props.name}
      size="3"
    >
      <RadixSelect.Trigger
        id={props.id}
        aria-label={props['aria-label']}
        placeholder={placeholder}
        className="admin-select"
      />
      <RadixSelect.Content position="popper" className="admin-select-content">
        {options
          .filter((option: FieldValue) => option.value !== '')
          .map((option: FieldValue) => (
            <RadixSelect.Item key={option.value} value={String(option.value)}>
              {option.label}
            </RadixSelect.Item>
          ))}
      </RadixSelect.Content>
    </RadixSelect.Root>
  );
}
export function useSelect(options: FieldValue) {
  const core = useCoreSelect(options);
  return { selectProps: { options: core.options } };
}
export function Upload({
  children,
  accept,
  customRequest,
}: Props & {
  customRequest: (options: {
    file: File;
    onSuccess: (data: unknown) => void;
    onError: (error: Error) => void;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const id = useId();
  return (
    <div className="admin-upload">
      <div aria-hidden="true" className="admin-upload-decoration">
        {children}
      </div>
      <label className="admin-file-label" htmlFor={id}>
        {busy ? 'Uploading…' : 'Choose file'}
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              await customRequest({ file, onSuccess: () => {}, onError: () => {} });
            } finally {
              setBusy(false);
              event.target.value = '';
            }
          }}
        />
      </label>
    </div>
  );
}
