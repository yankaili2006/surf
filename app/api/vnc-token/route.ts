import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SCRIPT_PATH = '/home/primihub/pcloud/infra/surf/scripts/manage-vnc-token.sh';

export async function POST(request: NextRequest) {
  try {
    const { action, sandboxId, vmIp } = await request.json();

    if (!action || !sandboxId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, sandboxId' },
        { status: 400 }
      );
    }

    let command: string;

    switch (action) {
      case 'add':
        if (!vmIp) {
          return NextResponse.json(
            { error: 'Missing vmIp for add action' },
            { status: 400 }
          );
        }
        command = `${SCRIPT_PATH} add "${sandboxId}" "${vmIp}"`;
        break;

      case 'remove':
        command = `${SCRIPT_PATH} remove "${sandboxId}"`;
        break;

      case 'list':
        command = `${SCRIPT_PATH} list`;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const { stdout, stderr } = await execAsync(command);

    return NextResponse.json({
      success: true,
      action,
      sandboxId,
      output: stdout,
      error: stderr || null,
    });

  } catch (error) {
    console.error('VNC token management error:', error);
    return NextResponse.json(
      {
        error: 'Failed to manage VNC token',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { stdout } = await execAsync(`${SCRIPT_PATH} list`);

    // Parse token list
    const lines = stdout.split('\n').filter(line =>
      line.trim() && !line.startsWith('#') && !line.startsWith('===')
    );

    const tokens = lines.map(line => {
      const match = line.match(/^(\S+):\s*(\S+):(\d+)/);
      if (match) {
        return {
          sandboxId: match[1],
          vmIp: match[2],
          port: parseInt(match[3]),
        };
      }
      return null;
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      tokens,
      count: tokens.length,
    });

  } catch (error) {
    console.error('Failed to list VNC tokens:', error);
    return NextResponse.json(
      {
        error: 'Failed to list VNC tokens',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
