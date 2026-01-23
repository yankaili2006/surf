import { Sandbox } from "@e2b/desktop";
import { ComputerModel, SSEEvent, SSEEventType } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  createStreamingResponse,
} from "@/lib/streaming";
import { SANDBOX_TIMEOUT_MS } from "@/lib/config";
import { OpenAIComputerStreamer } from "@/lib/streaming/openai";
import { AnthropicComputerStreamer } from "@/lib/streaming/anthropic";
import { logError, logInfo, logWarning } from "@/lib/logger";
import { ResolutionScaler } from "@/lib/streaming/resolution";
import { sandboxPool } from "@/lib/sandbox-pool";

export const maxDuration = 800;

// Helper function to create streamer with fallback support
function createStreamerWithFallback(
  primaryModel: ComputerModel,
  desktop: Sandbox,
  resolution: [number, number]
): ComputerInteractionStreamerFacade {
  try {
    return StreamerFactory.getStreamer(primaryModel, desktop, resolution);
  } catch (error) {
    logWarning(`Failed to create ${primaryModel} streamer, falling back to alternative`, error);

    // Fallback logic: if primary fails, try the other provider
    const fallbackModel = primaryModel === "anthropic" ? "openai" : "anthropic";

    try {
      logInfo(`Attempting fallback to ${fallbackModel} provider`);
      return StreamerFactory.getStreamer(fallbackModel as ComputerModel, desktop, resolution);
    } catch (fallbackError) {
      logError(`Fallback to ${fallbackModel} also failed`, fallbackError);
      throw new Error(`Both ${primaryModel} and ${fallbackModel} providers failed`);
    }
  }
}

// Local E2B API helper
async function createLocalSandbox(templateId: string, apiKey: string, baseUrl: string) {
  const response = await fetch(`${baseUrl}/sandboxes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      templateID: templateId,
      timeout: Math.floor(SANDBOX_TIMEOUT_MS / 1000),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create sandbox: ${error}`);
  }

  const data = await response.json();
  return {
    sandboxId: data.sandboxID,
    clientId: data.clientID,
    envdUrl: data.envdURL,
  };
}

class StreamerFactory {
  static getStreamer(
    model: ComputerModel,
    desktop: Sandbox,
    resolution: [number, number]
  ): ComputerInteractionStreamerFacade {
    const resolutionScaler = new ResolutionScaler(desktop, resolution);

    switch (model) {
      case "anthropic":
        return new AnthropicComputerStreamer(desktop, resolutionScaler);
      case "openai":
      default:
        return new OpenAIComputerStreamer(desktop, resolutionScaler);
    }
  }
}

export async function POST(request: Request) {
  const abortController = new AbortController();
  const { signal } = abortController;

  request.signal.addEventListener("abort", () => {
    abortController.abort();
  });

  const {
    messages,
    sandboxId,
    resolution,
    model = "openai",
  } = await request.json();

  const apiKey = process.env.E2B_API_KEY;
  const baseUrl = process.env.E2B_BASE_URL || process.env.E2B_API_URL || 'http://localhost:3000';
  const isLocalInfra = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

  if (!apiKey) {
    return new Response("E2B API key not found", { status: 500 });
  }

  let desktop: Sandbox | undefined;
  let activeSandboxId = sandboxId;
  let vncUrl: string | undefined;
  let shouldReturnToPool = false;
  let poolTemplateId: string | undefined;

  try {
    if (!activeSandboxId) {
      const templateId = process.env.E2B_DESKTOP_TEMPLATE_ID || 'desktop-vnc';

      if (isLocalInfra) {
        // For local infrastructure, create sandbox directly via API
        logInfo("Creating sandbox via local API:", baseUrl);
        const result = await createLocalSandbox(templateId, apiKey, baseUrl);
        activeSandboxId = result.sandboxId;

        // VNC URL for local infrastructure (noVNC on port 6080)
        const noVNCHost = process.env.NEXT_PUBLIC_VNC_HOST || '100.64.0.23';

        // Extract IP from envdURL (format: http://10.11.0.X:49983)
        const envdUrl = result.envdUrl || '';
        const ipMatch = envdUrl.match(/http:\/\/([^:]+):/);
        const sandboxIP = ipMatch ? ipMatch[1] : '10.11.0.141';

        logInfo("Extracted sandbox IP:", sandboxIP, "from envdURL:", envdUrl);

        // Update websockify token for this sandbox (BLOCKING - wait for completion)
        // This ensures VNC connection works immediately when iframe loads
        try {
          const tokenResponse = await fetch('http://localhost:3001/api/vnc-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              sandboxId: activeSandboxId,
              vmIp: sandboxIP,
            }),
          });

          if (tokenResponse.ok) {
            logInfo("VNC token updated for sandbox:", activeSandboxId);
          } else {
            const errorText = await tokenResponse.text();
            logError("Failed to update VNC token:", errorText);
          }
        } catch (error) {
          logError("Error updating VNC token:", error);
        }

        // Use token mode for websockify (matches token config file)
        // Add password parameter to auto-login without user input
        vncUrl = `http://${noVNCHost}:6080/vnc.html?path=websockify?token=${activeSandboxId}&autoconnect=true&password=e2bdesktop`;

        logInfo("Local sandbox created:", activeSandboxId);

        // Only connect Desktop SDK if we have messages to process (AI interaction needed)
        // This saves ~9 seconds when just creating a sandbox without AI
        if (messages && messages.length > 0) {
          try {
            desktop = await Sandbox.connect(activeSandboxId, {
              apiKey: apiKey,
              baseUrl: baseUrl,
            });
            logInfo("Desktop SDK connected to local sandbox");
          } catch (error) {
            logError("Failed to connect Desktop SDK to local sandbox:", error);
            // Continue without desktop object - will return error later if needed
          }
        } else {
          logInfo("Skipping Desktop SDK connection (no messages to process)");
        }
      } else {
        // For cloud E2B, use the sandbox pool
        const newSandbox = await sandboxPool.acquire(templateId, {
          resolution,
          dpi: 96,
          timeoutMs: SANDBOX_TIMEOUT_MS,
          apiKey: apiKey,
          baseUrl: baseUrl,
        });

        await newSandbox.stream.start();

        activeSandboxId = newSandbox.sandboxId;
        vncUrl = newSandbox.stream.getUrl();
        desktop = newSandbox;

        // Mark for pool return
        shouldReturnToPool = true;
        poolTemplateId = templateId;
      }
    } else {
      // Connecting to existing sandbox
      try {
        desktop = await Sandbox.connect(activeSandboxId, {
          apiKey: apiKey,
          baseUrl: baseUrl,
        });
        logInfo("Connected to existing sandbox:", activeSandboxId);
      } catch (error) {
        logError("Failed to connect to existing sandbox:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to connect to sandbox",
            sandboxId: activeSandboxId,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // If no messages and we just created a sandbox, return VNC URL immediately
    if (!sandboxId && activeSandboxId && vncUrl && (!messages || messages.length === 0)) {
      async function* stream(): AsyncGenerator<SSEEvent<typeof model>> {
        yield {
          type: SSEEventType.SANDBOX_CREATED,
          sandboxId: activeSandboxId,
          vncUrl: vncUrl as string,
        };
        yield {
          type: SSEEventType.DONE,
        };
      }
      return createStreamingResponse(stream());
    }

    if (!desktop) {
      return new Response("Failed to connect to sandbox", { status: 500 });
    }

    desktop.setTimeout(SANDBOX_TIMEOUT_MS);

    try {
      const streamer = createStreamerWithFallback(
        model as ComputerModel,
        desktop,
        resolution
      );

      if (!sandboxId && activeSandboxId && vncUrl) {
        async function* stream(): AsyncGenerator<SSEEvent<typeof model>> {
          yield {
            type: SSEEventType.SANDBOX_CREATED,
            sandboxId: activeSandboxId,
            vncUrl: vncUrl as string,
          };

          // Only call AI if user sent actual messages (not just creating sandbox)
          if (messages && messages.length > 0) {
            try {
              // Manually iterate to catch errors during streaming
              for await (const event of streamer.stream({ messages, signal })) {
                yield event;
              }
            } catch (error) {
              logError("AI streaming error (non-blocking):", error);
              yield {
                type: SSEEventType.ERROR,
                content: "AI service temporarily unavailable. Sandbox is ready for manual use.",
              };
            }
          }
        }

        return createStreamingResponse(stream());
      } else {
        return createStreamingResponse(streamer.stream({ messages, signal }));
      }
    } catch (error) {
      logError("Error from streaming service:", error);

      return new Response(
        "An error occurred with the AI service. Please try again.",
        { status: 500 }
      );
    }
  } catch (error) {
    logError("Error connecting to sandbox:", error);
    return new Response("Failed to connect to sandbox", { status: 500 });
  } finally {
    // Cleanup: Return sandbox to pool or close it
    // Note: For streaming responses, the desktop is still in use after this function returns.
    // The finally block only helps with error cases where streaming never started.
    // For active streams, the desktop will be closed by timeout (SANDBOX_TIMEOUT_MS).
    if (desktop && signal.aborted) {
      // Only cleanup if request was aborted (user cancelled)
      if (shouldReturnToPool && poolTemplateId) {
        // Return to pool for reuse
        await sandboxPool.release(poolTemplateId, desktop).catch((err: any) =>
          logError('Failed to return sandbox to pool:', err)
        );
      } else {
        // Close immediately (local infra or non-pooled sandbox)
        await desktop.kill().catch((err: any) =>
          logError('Failed to close sandbox during cleanup:', err)
        );
      }
    }
  }
}
