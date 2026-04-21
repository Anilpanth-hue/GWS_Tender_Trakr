import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET() {
  try {
    const configRows = await query<Record<string, unknown>>(
      'SELECT config_key, config_value, label, description FROM screening_config ORDER BY id'
    );
    const settingRows = await query<Record<string, unknown>>(
      'SELECT setting_key, setting_value, label FROM scrape_settings ORDER BY id'
    );

    return NextResponse.json<ApiResponse<{ config: unknown[]; settings: unknown[] }>>({
      data: {
        config: configRows.map(r => ({
          key: r.config_key,
          value: (() => { try { return JSON.parse(r.config_value as string); } catch { return r.config_value; } })(),
          label: r.label,
          description: r.description,
        })),
        settings: settingRows.map(r => ({
          key: r.setting_key,
          value: r.setting_value,
          label: r.label,
        })),
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { type: 'config' | 'setting'; key: string; value: unknown };

    if (body.type === 'config') {
      await execute(
        'UPDATE screening_config SET config_value = ? WHERE config_key = ?',
        [JSON.stringify(body.value), body.key]
      );
    } else if (body.type === 'setting') {
      await execute(
        'UPDATE scrape_settings SET setting_value = ? WHERE setting_key = ?',
        [String(body.value), body.key]
      );
    } else {
      return NextResponse.json<ApiResponse>({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json<ApiResponse>({ message: 'Updated successfully' });
  } catch {
    return NextResponse.json<ApiResponse>({ error: 'Failed to update setting' }, { status: 500 });
  }
}
