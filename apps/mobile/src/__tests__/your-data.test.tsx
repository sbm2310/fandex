import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AccountScreen from '@/app/(tabs)/account';
import {
  createFakePreorders,
  createMemoryCollection,
  createWrapper,
  FakeAccountService,
  hobbit,
} from '@/test-utils/providers';
import { saveExport } from '@/utils/save-export';

jest.mock('@/utils/save-export', () => ({ saveExport: jest.fn(() => Promise.resolve()) }));
jest.mock('@/utils/today', () => ({ localToday: () => '2026-10-19' }));
const mockSave = jest.mocked(saveExport);

const PASSWORD = 'correct horse battery';

beforeEach(() => mockSave.mockReset().mockResolvedValue(undefined));

async function withItem() {
  const collection = createMemoryCollection();
  await collection.add(hobbit);
  return collection;
}

const exportButton = (format: 'JSON' | 'CSV') =>
  screen.findByRole('button', { name: `Export as ${format}` });

describe('Your data', () => {
  it("exports a guest's device collection as CSV", async () => {
    await render(<AccountScreen />, {
      wrapper: createWrapper({ deviceCollection: await withItem() }),
    });

    expect(await screen.findByText(/1 item on this device/)).toBeOnTheScreen();
    await fireEvent.press(await exportButton('CSV'));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const [name, content, format] = mockSave.mock.calls[0]!;
    expect(name).toBe('fandex-collection-2026-10-19.csv');
    expect(format).toBe('csv');
    expect(content).toContain('The Hobbit,,Book,J.R.R. Tolkien');
  });

  it("exports an account's collection and pre-orders as JSON", async () => {
    const account = new FakeAccountService();
    account.register('Reader', 'reader@example.com', PASSWORD);
    await account.signIn({ email: 'reader@example.com', password: PASSWORD });
    await render(<AccountScreen />, {
      wrapper: createWrapper({
        account,
        accountCollection: await withItem(),
        preorders: createFakePreorders(),
      }),
    });

    expect(await screen.findByText(/1 item in your account.*pre-orders too/)).toBeOnTheScreen();
    await fireEvent.press(await exportButton('JSON'));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const [name, content] = mockSave.mock.calls[0]!;
    expect(name).toBe('fandex-collection-2026-10-19.json');
    const parsed = JSON.parse(content);
    expect(
      parsed.collection.map((item: { catalog: { title: string } }) => item.catalog.title),
    ).toEqual(['The Hobbit']);
    expect(parsed.preorders).toEqual([]);
  });

  it('says when the file could not be made', async () => {
    mockSave.mockRejectedValue(new Error("Sharing isn't available on this device."));
    await render(<AccountScreen />, {
      wrapper: createWrapper({ deviceCollection: await withItem() }),
    });

    await fireEvent.press(await exportButton('CSV'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't export your collection. Sharing isn't available on this device.",
    );
  });

  it('has nothing to export from an empty collection', async () => {
    await render(<AccountScreen />, {
      wrapper: createWrapper({ deviceCollection: createMemoryCollection() }),
    });

    expect(await screen.findByText(/Nothing to export yet/)).toBeOnTheScreen();
    expect(await exportButton('CSV')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export as JSON' })).toBeDisabled();
  });
});
