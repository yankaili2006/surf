import { Sandbox } from "@e2b/desktop";
import { ComputerModel, SSEEvent, SSEEventType } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  createStreamingResponse,
} from "@/lib/streaming";
import { SANDBOX_TIMEOUT_MS } from "@/lib/config";
import { OpenAIComputerStreamer } from "@/lib/streaming/openai";
import { AnthropicComputerStreamer } from "@/lib/streaming/anthropic";
import { logError } from "@/lib/logger";
import { ResolutionScaler } from "@/lib/streaming/resolution";

export const maxDuration = 800;

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

  if (!apiKey) {
    return new Response("E2B API key not found", { status: 500 });
  }

  let desktop: Sandbox | undefined;
  let activeSandboxId = sandboxId;
  let vncUrl: string | undefined;

  try {
    if (!activeSandboxId) {
      // Use the local desktop template ID
      const templateId = process.env.E2B_DESKTOP_TEMPLATE_ID || 'desktop-template-000-0000-0000-000000000001';
      const baseUrl = process.env.E2B_BASE_URL || process.env.E2B_API_URL;

      const newSandbox = await Sandbox.create(templateId, {
        resolution,
        dpi: 96,
        timeoutMs: SANDBOX_TIMEOUT_MS,
        apiKey: apiKey,
        ...(baseUrl && { baseUrl: baseUrl }),
      });

      await newSandbox.stream.start();

      activeSandboxId = newSandbox.sandboxId;
      vncUrl = newSandbox.stream.getUrl();
      desktop = newSandbox;
    } else {
      const baseUrl = process.env.E2B_BASE_URL || process.env.E2B_API_URL;
      desktop = await Sandbox.connect(activeSandboxId, {
        apiKey: apiKey,
        ...(baseUrl && { baseUrl: baseUrl }),
      });
    }

    if (!desktop) {
      return new Response("Failed to connect to sandbox", { status: 500 });
    }

    desktop.setTimeout(SANDBOX_TIMEOUT_MS);

    try {
      const streamer = StreamerFactory.getStreamer(
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

          yield* streamer.stream({ messages, signal });
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
  }
}
