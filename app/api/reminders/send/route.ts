import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('id, reminder_time, reminder_email, sender_name, sender_email')
      .order('id', { ascending: true })
      .limit(1)
      .single();

    if (error || !settings) {
      return NextResponse.json(
        { ok: false, message: 'Settings not found.' },
        { status: 404 },
      );
    }

    if (
      !settings.reminder_email ||
      !settings.sender_name ||
      !settings.sender_email
    ) {
      return NextResponse.json(
        { ok: false, message: 'Reminder settings are incomplete.' },
        { status: 400 },
      );
    }

    const result = await transporter.sendMail({
      from: `${settings.sender_name} <${settings.sender_email}>`,
      to: settings.reminder_email,
      subject: 'Daily work log reminder',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Daily Reminder</h2>
          <p>Don&apos;t forget to log today&apos;s completed work.</p>
        </div>
      `,
    });

    return NextResponse.json({
      ok: true,
      message: 'Reminder email sent.',
      messageId: result.messageId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown server error';

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
