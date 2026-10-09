export interface SendEmailOptions {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  isSimulated: boolean;
  timestamp: string;
}

export interface EmailProviderStatus {
  providerName: string;
  isConfigured: boolean;
  sendEnabled: boolean;
  mode: 'real' | 'demo';
  defaultSender: string;
}

export interface IEmailProvider {
  sendEmail(options: SendEmailOptions): Promise<EmailSendResult>;
  getProviderStatus(): EmailProviderStatus;
}

export class ResendEmailProvider implements IEmailProvider {
  private apiKey: string | null;
  private defaultSender: string;
  private sendEnabled: boolean;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY?.trim() || null;
    this.defaultSender = process.env.OUTREACH_FROM_EMAIL || 'outreach@leadforge.ai';
    this.sendEnabled = process.env.OUTREACH_SEND_ENABLED === 'true';
  }

  getProviderStatus(): EmailProviderStatus {
    return {
      providerName: 'resend',
      isConfigured: Boolean(this.apiKey),
      sendEnabled: this.sendEnabled,
      mode: this.apiKey && this.sendEnabled ? 'real' : 'demo',
      defaultSender: this.defaultSender,
    };
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const timestamp = new Date().toISOString();

    // Safety guardrail: if real sending is disabled or API key is missing, simulate sending safely
    if (!this.sendEnabled || !this.apiKey) {
      const mockId = `resend-sim-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      return {
        success: true,
        providerMessageId: mockId,
        isSimulated: true,
        timestamp,
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: options.from || this.defaultSender,
          to: [options.to],
          reply_to: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
          tags: options.tags
            ? Object.entries(options.tags).map(([name, value]) => ({ name, value }))
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: `Resend HTTP ${response.status}: ${errorBody.substring(0, 300)}`,
          isSimulated: false,
          timestamp,
        };
      }

      const data = (await response.json()) as { id: string };
      return {
        success: true,
        providerMessageId: data.id,
        isSimulated: false,
        timestamp,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Resend dispatch failed: ${err.message || 'Unknown network error'}`,
        isSimulated: false,
        timestamp,
      };
    }
  }
}

export class MockEmailProvider implements IEmailProvider {
  private sentHistory: Array<SendEmailOptions & { messageId: string; timestamp: string }> = [];
  public shouldFail: boolean = false;
  public failureMessage: string = 'Simulated delivery failure';

  getProviderStatus(): EmailProviderStatus {
    return {
      providerName: 'mock',
      isConfigured: true,
      sendEnabled: true,
      mode: 'demo',
      defaultSender: 'demo@leadforge.test',
    };
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const timestamp = new Date().toISOString();

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureMessage,
        isSimulated: true,
        timestamp,
      };
    }

    const messageId = `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.sentHistory.push({ ...options, messageId, timestamp });

    return {
      success: true,
      providerMessageId: messageId,
      isSimulated: true,
      timestamp,
    };
  }

  getHistory(): Array<SendEmailOptions & { messageId: string; timestamp: string }> {
    return [...this.sentHistory];
  }

  clearHistory(): void {
    this.sentHistory = [];
  }
}

let activeProvider: IEmailProvider | null = null;

export function getEmailProvider(): IEmailProvider {
  if (activeProvider) {
    return activeProvider;
  }

  if (process.env.NODE_ENV === 'test') {
    activeProvider = new MockEmailProvider();
    return activeProvider;
  }

  if (process.env.RESEND_API_KEY) {
    activeProvider = new ResendEmailProvider();
  } else {
    activeProvider = new MockEmailProvider();
  }

  return activeProvider;
}

export function setEmailProvider(provider: IEmailProvider): void {
  activeProvider = provider;
}

