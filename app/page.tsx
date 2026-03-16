'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { autoTable } from 'jspdf-autotable';
import { jsPDF } from 'jspdf';

type WorkLog = {
  id: number;
  work_date: string;
  client: string;
  task_description: string;
  hours: number;
  notes: string | null;
  billable: boolean;
  created_at: string;
};

export default function HomePage() {
  const today = new Date().toISOString().split('T')[0];

  const [workDate, setWorkDate] = useState(today);
  const [client, setClient] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [billable, setBillable] = useState(true);
  const [message, setMessage] = useState('');
  const [entries, setEntries] = useState<WorkLog[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [selectedClient, setSelectedClient] = useState('');
  const [clientRates, setClientRates] = useState<Record<string, number>>({});
  const [clientsData, setClientsData] = useState<
    Record<
      string,
      {
        hourly_rate: number;
        address_line_1: string | null;
        address_line_2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
      }
    >
  >({});
  const [reminderTime, setReminderTime] = useState('16:00');
  const [reminderMessage, setReminderMessage] = useState('');
  const [settingsId, setSettingsId] = useState<number | null>(null);
  const [showReminderAlert, setShowReminderAlert] = useState(false);
  const [reminderEmail, setReminderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');

  const currentMonth = new Date().toISOString().slice(0, 7);

  const currentMonthEntries = entries.filter((entry) =>
    entry.work_date.startsWith(currentMonth),
  );

  const monthlySummary = currentMonthEntries.reduce<
    Record<string, { totalHours: number; entryCount: number }>
  >((acc, entry) => {
    if (!acc[entry.client]) {
      acc[entry.client] = { totalHours: 0, entryCount: 0 };
    }

    acc[entry.client].totalHours += Number(entry.hours);
    acc[entry.client].entryCount += 1;

    return acc;
  }, {});

  const clientNames = Object.keys(monthlySummary);

  const invoiceClient = selectedClient || clientNames[0] || '';

  const invoiceEntries = currentMonthEntries.filter(
    (entry) => entry.client === invoiceClient,
  );

  const invoiceTotalHours = invoiceEntries.reduce(
    (sum, entry) => sum + Number(entry.hours),
    0,
  );

  const invoicePeriod = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  const invoiceRate = clientRates[invoiceClient] || 0;
  const selectedClientData = clientsData[invoiceClient] || {
    hourly_rate: 0,
    address_line_1: null,
    address_line_2: null,
    city: null,
    state: null,
    zip: null,
    country: null,
  };
  const invoiceTotalAmount = invoiceTotalHours * invoiceRate;
  const invoiceDate = new Date().toLocaleDateString('en-US');

  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, '0')}-${invoiceClient.replace(/\s+/g, '-').toUpperCase()}`;

  const senderInfo = {
    name: 'Tatiana Grigorieva',
    address_line_1: '85420 Dudley',
    address_line_2: '',
    city: 'Chapel Hill',
    state: 'NC',
    zip: '27517',
    country: 'USA',
    email: 'tsg1204@gmail.com',
  };

  const invoiceData = {
    sender: senderInfo,
    client: {
      name: invoiceClient,
      address_line_1: selectedClientData.address_line_1,
      address_line_2: selectedClientData.address_line_2,
      city: selectedClientData.city,
      state: selectedClientData.state,
      zip: selectedClientData.zip,
      country: selectedClientData.country,
    },
    period: invoicePeriod,
    entries: invoiceEntries,
    totalHours: invoiceTotalHours,
    rate: invoiceRate,
    totalAmount: invoiceTotalAmount,
    date: invoiceDate,
    number: invoiceNumber,
  };

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  async function loadEntries() {
    const { data, error } = await supabase
      .from('work_logs')
      .select('*')
      .order('work_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      setMessage(`Error loading entries: ${error.message}`);
      setLoadingEntries(false);
      return;
    }

    setEntries(data || []);
    setLoadingEntries(false);
  }

  async function loadClients() {
    const { data, error } = await supabase
      .from('clients')
      .select(
        'name, hourly_rate, address_line_1, address_line_2, city, state, zip, country',
      );

    if (error) {
      setMessage(`Error loading clients: ${error.message}`);
      return;
    }

    const rates: Record<string, number> = {};
    const clientDetails: Record<
      string,
      {
        hourly_rate: number;
        address_line_1: string | null;
        address_line_2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
      }
    > = {};

    data?.forEach((client) => {
      const rate = Number(client.hourly_rate);

      rates[client.name] = rate;
      clientDetails[client.name] = {
        hourly_rate: rate,
        address_line_1: client.address_line_1,
        address_line_2: client.address_line_2,
        city: client.city,
        state: client.state,
        zip: client.zip,
        country: client.country,
      };
    });

    setClientRates(rates);
    setClientsData(clientDetails);
  }

  async function loadReminderSetting() {
    const { data, error } = await supabase
      .from('settings')
      .select('id, reminder_time, reminder_email, sender_name, sender_email')
      .order('id', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      setReminderMessage(`Error loading reminder: ${error.message}`);
      return;
    }

    setReminderTime(data.reminder_time);
    setSettingsId(data.id);
    setReminderEmail(data.reminder_email || '');
    setSenderName(data.sender_name || '');
    setSenderEmail(data.sender_email || '');
  }

  useEffect(() => {
    let ignore = false;

    async function fetchEntries() {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .order('work_date', { ascending: false })
        .order('id', { ascending: false });

      if (ignore) return;

      if (error) {
        setMessage(`Error loading entries: ${error.message}`);
      } else {
        setEntries(data || []);
      }

      await loadClients();
      setLoadingEntries(false);
      await loadReminderSetting();
    }

    fetchEntries();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);

      if (currentTime === reminderTime) {
        setShowReminderAlert(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [reminderTime]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('Saving...');

    const { error } = await supabase.from('work_logs').insert([
      {
        work_date: workDate,
        client,
        task_description: taskDescription,
        hours: Number(hours),
        notes,
        billable,
      },
    ]);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setClient('');
    setTaskDescription('');
    setHours('');
    setNotes('');
    setBillable(true);
    setWorkDate(today);

    setLoadingEntries(true);
    await loadEntries();
    setMessage('Entry saved successfully.');
  }

  function generateInvoicePdf() {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Invoice', 14, 20);

    doc.setFontSize(11);
    doc.text(invoiceData.sender.name, 14, 32);
    doc.text(invoiceData.sender.address_line_1, 14, 38);

    if (invoiceData.sender.address_line_2) {
      doc.text(invoiceData.sender.address_line_2, 14, 44);
    }

    doc.text(
      `${invoiceData.sender.city}, ${invoiceData.sender.state} ${invoiceData.sender.zip}`,
      14,
      invoiceData.sender.address_line_2 ? 50 : 44,
    );
    doc.text(
      invoiceData.sender.country,
      14,
      invoiceData.sender.address_line_2 ? 56 : 50,
    );
    doc.text(
      invoiceData.sender.email,
      14,
      invoiceData.sender.address_line_2 ? 62 : 56,
    );

    doc.text(`Bill To:`, 140, 32);
    doc.text(invoiceData.client.name || '', 140, 38);

    let clientY = 44;

    if (invoiceData.client.address_line_1) {
      doc.text(invoiceData.client.address_line_1, 140, clientY);
      clientY += 6;
    }

    if (invoiceData.client.address_line_2) {
      doc.text(invoiceData.client.address_line_2, 140, clientY);
      clientY += 6;
    }

    const clientCityLine = [
      invoiceData.client.city,
      invoiceData.client.state,
      invoiceData.client.zip,
    ]
      .filter(Boolean)
      .join(', ')
      .replace(', ,', ',');

    if (clientCityLine) {
      doc.text(clientCityLine, 140, clientY);
      clientY += 6;
    }

    if (invoiceData.client.country) {
      doc.text(invoiceData.client.country, 140, clientY);
    }

    doc.text(`Invoice Number: ${invoiceData.number}`, 14, 76);
    doc.text(`Invoice Date: ${invoiceData.date}`, 14, 84);
    doc.text(`Billing Period: ${invoiceData.period}`, 14, 92);
    doc.text(`Hourly Rate: ${formatCurrency(invoiceData.rate)}`, 14, 100);
    doc.text(`Total Hours: ${invoiceData.totalHours.toFixed(2)}`, 14, 108);
    doc.text(
      `Invoice Total: ${formatCurrency(invoiceData.totalAmount)}`,
      14,
      116,
    );

    autoTable(doc, {
      startY: 126,
      head: [['Date', 'Task', 'Hours', 'Notes']],
      body: invoiceData.entries.map((entry) => [
        entry.work_date,
        entry.task_description,
        Number(entry.hours).toFixed(2),
        entry.notes || '',
      ]),
    });

    const safeClientName = (invoiceData.client.name || 'invoice')
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9\-]/gi, '')
      .toLowerCase();

    const safePeriod = invoiceData.period
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9\-]/gi, '')
      .toLowerCase();

    doc.save(`${safeClientName}-${safePeriod}-${invoiceData.number}.pdf`);
  }

  async function saveReminderSetting() {
    if (!settingsId) {
      setReminderMessage('Settings row not found.');
      return;
    }

    setReminderMessage('Saving reminder...');

    const { error } = await supabase
      .from('settings')
      .update({
        reminder_time: reminderTime,
        reminder_email: reminderEmail,
        sender_name: senderName,
        sender_email: senderEmail,
      })
      .eq('id', settingsId);

    if (error) {
      setReminderMessage(`Error saving reminder: ${error.message}`);
      return;
    }

    setReminderMessage('Reminder time saved.');
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto space-y-8 max-w-5xl">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="mb-2 text-3xl font-bold text-black">Daily Work Log</h1>
          <p className="mb-6 text-gray-600">
            Record today&apos;s work for future invoices.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-black">
                Date
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-black">
                Client
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Enter client name"
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-black">
                Task Description
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="What did you do today?"
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
                rows={4}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-black">
                Hours
              </label>
              <input
                type="number"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 2.5"
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-black">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="h-4 w-4"
              />
              <label
                htmlFor="billable"
                className="text-sm font-medium text-black"
              >
                Billable
              </label>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-black px-5 py-3 text-white"
            >
              Save Entry
            </button>

            {message && <p className="text-sm text-gray-700">{message}</p>}
          </form>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <h2 className="mb-4 text-2xl font-bold text-black">Work Log</h2>
          <div className="rounded-2xl bg-white p-8 shadow">
            <h2 className="mb-4 text-2xl font-bold text-black">
              Reminder Settings
            </h2>

            <p className="mb-4 text-sm text-gray-600">
              Daily reminder is set for{' '}
              <span className="font-medium text-black">{reminderTime}</span>.
            </p>
            {showReminderAlert && (
              <div className="mt-4 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-black">Daily Reminder</p>
                    <p className="text-sm text-gray-700">
                      Don&apos;t forget to log today&apos;s completed work.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowReminderAlert(false)}
                    className="rounded-lg bg-black px-3 py-2 text-sm text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-black">
                Reminder recipient email
              </label>
              <input
                type="email"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
              />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-black">
                Sender name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Work Log System"
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-black">
                Sender email
              </label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="reminders@yourapp.com"
                className="w-full rounded-lg border border-gray-300 p-3 text-black"
              />
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div>
                <label className="mb-1 block text-sm font-medium text-black">
                  Daily reminder time
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="rounded-lg border border-gray-300 p-3 text-black"
                />
              </div>

              <button
                type="button"
                onClick={saveReminderSetting}
                className="rounded-lg bg-black px-5 py-3 text-white"
              >
                Save Reminder Settings
              </button>
            </div>

            {reminderMessage && (
              <p className="mt-3 text-sm text-gray-700">{reminderMessage}</p>
            )}
          </div>
          <div className="rounded-2xl bg-white p-8 shadow">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-black">Invoice Preview</h2>

              <div className="sm:w-72">
                <label className="mb-1 block text-sm font-medium text-black">
                  Select Client
                </label>
                <select
                  value={invoiceClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 text-black"
                >
                  {clientNames.length === 0 ? (
                    <option value="">No clients yet</option>
                  ) : (
                    clientNames.map((clientName) => (
                      <option key={clientName} value={clientName}>
                        {clientName}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {loadingEntries ? (
              <p className="text-gray-600">Loading invoice preview...</p>
            ) : !invoiceClient ? (
              <p className="text-gray-600">
                No client entries for this month yet.
              </p>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-black">
                        Invoice Draft
                      </h3>
                      <p className="text-sm text-gray-600">
                        Billing period: {invoicePeriod}
                      </p>
                    </div>
                    <div className="text-sm text-gray-700">
                      <p>
                        <span className="font-medium text-black">Client:</span>{' '}
                        {invoiceClient}
                      </p>
                      <p>
                        <span className="font-medium text-black">
                          Total Hours:
                        </span>{' '}
                        {invoiceTotalHours.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left text-black">
                            Date
                          </th>
                          <th className="px-3 py-2 text-left text-black">
                            Task
                          </th>
                          <th className="px-3 py-2 text-left text-black">
                            Hours
                          </th>
                          <th className="px-3 py-2 text-left text-black">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceEntries.map((entry) => (
                          <tr key={entry.id} className="border-b align-top">
                            <td className="px-3 py-2 text-black">
                              {entry.work_date}
                            </td>
                            <td className="px-3 py-2 text-black">
                              {entry.task_description}
                            </td>
                            <td className="px-3 py-2 text-black">
                              {Number(entry.hours).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-black">
                              {entry.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-4">
                    <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-black">
                      <p>
                        <span className="font-semibold">Total Hours: </span>
                        {invoiceTotalHours.toFixed(2)}
                      </p>
                      <p>
                        <span className="font-semibold">Rate: </span>$
                        {invoiceRate.toFixed(2)}
                      </p>
                      <p>
                        <span className="font-semibold">Invoice Total: </span>$
                        {invoiceTotalAmount.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateInvoicePdf}
                      className="rounded-lg bg-black px-5 py-3 text-white"
                    >
                      Generate PDF
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-8 shadow">
            <h2 className="mb-4 text-2xl font-bold text-black">
              Monthly Summary
            </h2>

            {loadingEntries ? (
              <p className="text-gray-600">Loading summary...</p>
            ) : currentMonthEntries.length === 0 ? (
              <p className="text-gray-600">No entries for this month yet.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Current month:{' '}
                  <span className="font-medium text-black">{currentMonth}</span>
                </p>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left text-black">
                          Client
                        </th>
                        <th className="px-3 py-2 text-left text-black">
                          Entries
                        </th>
                        <th className="px-3 py-2 text-left text-black">
                          Total Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(monthlySummary).map(
                        ([clientName, summary]) => (
                          <tr key={clientName} className="border-b">
                            <td className="px-3 py-2 text-black">
                              {clientName}
                            </td>
                            <td className="px-3 py-2 text-black">
                              {summary.entryCount}
                            </td>
                            <td className="px-3 py-2 text-black">
                              {summary.totalHours.toFixed(2)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {loadingEntries ? (
            <p className="text-gray-600">Loading entries...</p>
          ) : entries.length === 0 ? (
            <p className="text-gray-600">No entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left text-black">Date</th>
                    <th className="px-3 py-2 text-left text-black">Client</th>
                    <th className="px-3 py-2 text-left text-black">Task</th>
                    <th className="px-3 py-2 text-left text-black">Hours</th>
                    <th className="px-3 py-2 text-left text-black">Billable</th>
                    <th className="px-3 py-2 text-left text-black">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b align-top">
                      <td className="px-3 py-2 text-black">
                        {entry.work_date}
                      </td>
                      <td className="px-3 py-2 text-black">{entry.client}</td>
                      <td className="px-3 py-2 text-black">
                        {entry.task_description}
                      </td>
                      <td className="px-3 py-2 text-black">{entry.hours}</td>
                      <td className="px-3 py-2 text-black">
                        {entry.billable ? 'Yes' : 'No'}
                      </td>
                      <td className="px-3 py-2 text-black">
                        {entry.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
