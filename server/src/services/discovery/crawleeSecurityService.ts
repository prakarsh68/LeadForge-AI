import { URL } from 'node:url';
import net from 'node:net';

export interface UrlValidationOptions {
  allowLocalhost?: boolean;
}

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  domain?: string;
  error?: string;
}

/**
 * Server-Side Request Forgery (SSRF) and Safe URL Validation Service
 * Strictly enforces HTTP/HTTPS, rejects loopback, private RFC 1918, link-local,
 * and cloud metadata IP ranges to protect internal infrastructure.
 */
export class CrawleeSecurityService {
  private static readonly BLOCKED_HOSTNAMES = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'metadata.google.internal',
    'instance-data',
    'metadata',
  ]);

  /**
   * Validate that an IP address is not within a private, loopback, or link-local range.
   */
  public static isPrivateIp(ip: string): boolean {
    if (!net.isIP(ip)) {
      return false;
    }

    // IPv4 checks
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      const [b0, b1] = parts;

      // 0.0.0.0/8 (current network)
      if (b0 === 0) return true;

      // 127.0.0.0/8 (loopback)
      if (b0 === 127) return true;

      // 10.0.0.0/8 (private)
      if (b0 === 10) return true;

      // 172.16.0.0/12 (private: 172.16.0.0 - 172.31.255.255)
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

      // 192.168.0.0/16 (private)
      if (b0 === 192 && b1 === 168) return true;

      // 169.254.0.0/16 (link-local, cloud metadata service like AWS/GCP: 169.254.169.254)
      if (b0 === 169 && b1 === 254) return true;

      // 224.0.0.0/4 (multicast)
      if (b0 >= 224 && b0 <= 239) return true;

      // 240.0.0.0/4 (reserved)
      if (b0 >= 240) return true;

      return false;
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      if (normalized === '::1' || normalized === '::') return true;
      if (normalized.startsWith('fe80:')) return true; // Link-local
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique local
    }

    return false;
  }

  /**
   * Validate a starting or discovered URL for crawler safety.
   */
  public static validateUrl(
    rawUrl: string,
    allowedDomains?: string[],
    options?: UrlValidationOptions
  ): UrlValidationResult {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { isValid: false, error: 'URL must be a non-empty string.' };
    }

    let trimmed = rawUrl.trim();

    // Check basic length constraint
    if (trimmed.length > 2048) {
      return { isValid: false, error: 'URL exceeds maximum allowable length (2048 chars).' };
    }

    // Auto-normalize starting target without scheme to https://
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { isValid: false, error: `Invalid URL format: "${trimmed}".` };
    }

    // Protocol check: only http and https allowed
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        error: `Prohibited protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Loopback / Localhost exception for testing environments only
    const isLocalhostAddress = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (!options?.allowLocalhost || !isLocalhostAddress) {
      // Check blocked hostnames
      if (this.BLOCKED_HOSTNAMES.has(hostname)) {
        return {
          isValid: false,
          error: `Host "${hostname}" is prohibited for security reasons.`,
        };
      }

      // Reject raw IP addresses if they are private
      if (net.isIP(hostname) && this.isPrivateIp(hostname)) {
        return {
          isValid: false,
          error: `Destination IP "${hostname}" is in a private or restricted network range.`,
        };
      }
    }

    // Check allowed domains restriction if specified
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some((d) => {
        if (!d) return false;
        // Strip protocol, wildcard patterns (e.g. *.ramp.com -> ramp.com), and www.
        let clean = d.trim().toLowerCase().replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
        clean = clean.split('/')[0].split(':')[0];
        clean = clean.replace(/^\*\.?/, '').replace(/^www\./, '');
        if (!clean) return false;

        const normalizedHost = hostname.replace(/^www\./, '');
        return normalizedHost === clean || normalizedHost.endsWith(`.${clean}`);
      });

      if (!isAllowed) {
        return {
          isValid: false,
          domain: hostname,
          error: `Host "${hostname}" is not within the permitted domains: [${allowedDomains.join(', ')}].`,
        };
      }
    }

    return {
      isValid: true,
      normalizedUrl: parsed.toString(),
      domain: hostname.replace(/^www\./, ''),
    };
  }

  /**
   * Check if a discovered link should be enqueued based on domain rules.
   */
  public static isLinkAllowed(
    linkUrl: string,
    allowedDomains: string[],
    options?: UrlValidationOptions
  ): boolean {
    const res = this.validateUrl(linkUrl, allowedDomains, options);
    return res.isValid;
  }
}

