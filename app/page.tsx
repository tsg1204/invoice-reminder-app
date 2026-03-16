'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

  const clientRates: Record<string, number> = {
    CNDD: 30,
    RASA: 50,
    KabanovLab: 30,
  };

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
  const invoiceTotalAmount = invoiceTotalHours * invoiceRate;

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

      setLoadingEntries(false);
    }

    fetchEntries();

    return () => {
      ignore = true;
    };
  }, []);

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
                      <p>
                        <span className="font-medium text-black">
                          Hourly Rate:
                        </span>{' '}
                        ${invoiceRate.toFixed(2)}
                      </p>
                      <p>
                        <span className="font-medium text-black">
                          Invoice Total:
                        </span>{' '}
                        ${invoiceTotalAmount.toFixed(2)}
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

                  <div className="mt-4 flex justify-end">
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
