# LLM Provider Configuration Guide

Surf supports multiple LLM providers through environment variable configuration.

## Supported Providers

### 1. OpenAI (and OpenAI-compatible APIs)
- **Official OpenAI API**
- **DeepSeek** (cost-effective, OpenAI-compatible)
- **Any OpenAI-compatible API**

### 2. Anthropic Claude
- **Claude 3.5 Sonnet** with Computer Use capabilities

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```bash
# Set default LLM provider
NEXT_PUBLIC_DEFAULT_LLM_PROVIDER=openai  # or "anthropic"

# OpenAI / DeepSeek Configuration
OPENAI_BASE_URL=https://api.deepseek.com  # or https://api.openai.com
OPENAI_API_KEY=your_api_key_here

# Anthropic Configuration (optional)
ANTHROPIC_BASE_URL=https://api.anthropic.com  # or your proxy URL
ANTHROPIC_API_KEY=your_api_key_here
```

## Provider Selection

### Method 1: Environment Variable (Default)
Set `NEXT_PUBLIC_DEFAULT_LLM_PROVIDER` in `.env.local`:
- `openai` - Uses OpenAI or OpenAI-compatible API (DeepSeek, etc.)
- `anthropic` - Uses Anthropic Claude API

### Method 2: Runtime Selection (UI)
Users can switch providers in the UI using the model selector.

## Examples

### Using DeepSeek (Recommended for Cost)
```bash
NEXT_PUBLIC_DEFAULT_LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_API_KEY=sk-your-deepseek-key
```

### Using Official OpenAI
```bash
NEXT_PUBLIC_DEFAULT_LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.openai.com
OPENAI_API_KEY=sk-your-openai-key
```

### Using Anthropic Claude
```bash
NEXT_PUBLIC_DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

### Using Custom Proxy
```bash
NEXT_PUBLIC_DEFAULT_LLM_PROVIDER=openai
OPENAI_BASE_URL=http://your-proxy-server:3000/api
OPENAI_API_KEY=your_proxy_key
```

## Troubleshooting

### 403 Errors with Anthropic
- Check if your API key is valid
- Verify proxy server is accessible
- Try switching to OpenAI/DeepSeek provider

### 401 Errors with E2B
- Ensure `E2B_DEBUG=true` is set for local infrastructure
- Verify `E2B_API_KEY` matches your local setup

## API Compatibility

### OpenAI Provider
Supports any API that implements OpenAI's chat completion format:
- OpenAI GPT-4, GPT-3.5
- DeepSeek Chat
- Azure OpenAI
- LocalAI
- Ollama (with OpenAI compatibility layer)

### Anthropic Provider
Requires Anthropic's native API format with Computer Use tools support.

## Cost Comparison

| Provider | Model | Cost (per 1M tokens) |
|----------|-------|---------------------|
| DeepSeek | deepseek-chat | ~$0.14 input / $0.28 output |
| OpenAI | gpt-4-turbo | ~$10 input / $30 output |
| Anthropic | claude-3.5-sonnet | ~$3 input / $15 output |

**Recommendation**: Use DeepSeek for cost-effective development and testing.
