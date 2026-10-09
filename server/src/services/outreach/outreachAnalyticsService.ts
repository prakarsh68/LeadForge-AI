import { getDb } from '../../db/database.js';
import type { OutreachAnalyticsDTO } from '../../types/index.js';

export const outreachAnalyticsService = {
  getAnalytics(): OutreachAnalyticsDTO {
    const db = getDb();

    // 1. Funnel Counts
    const enrolled = (db.prepare('SELECT COUNT(*) as c FROM outreach_sequences').get() as any).c;
    const step1Sent = (
      db.prepare("SELECT COUNT(*) as c FROM outreach_messages WHERE step_number = 1 AND status = 'sent'").get() as any
    ).c;
    const step2Sent = (
      db.prepare("SELECT COUNT(*) as c FROM outreach_messages WHERE step_number = 2 AND status = 'sent'").get() as any
    ).c;
    const step3Sent = (
      db.prepare("SELECT COUNT(*) as c FROM outreach_messages WHERE step_number = 3 AND status = 'sent'").get() as any
    ).c;

    const totalSent = (
      db.prepare("SELECT COUNT(*) as c FROM engagement_events WHERE event_type = 'sent'").get() as any
    ).c;
    const bounced = (
      db.prepare("SELECT COUNT(*) as c FROM engagement_events WHERE event_type = 'bounced'").get() as any
    ).c;
    const delivered = Math.max(0, totalSent - bounced);
    const opened = (
      db.prepare("SELECT COUNT(DISTINCT lead_id) as c FROM engagement_events WHERE event_type = 'opened'").get() as any
    ).c;
    const clicked = (
      db.prepare("SELECT COUNT(DISTINCT lead_id) as c FROM engagement_events WHERE event_type = 'clicked'").get() as any
    ).c;
    const replied = (
      db.prepare("SELECT COUNT(DISTINCT lead_id) as c FROM engagement_events WHERE event_type = 'replied'").get() as any
    ).c;
    const unsubscribed = (
      db.prepare("SELECT COUNT(DISTINCT lead_id) as c FROM engagement_events WHERE event_type = 'unsubscribed'").get() as any
    ).c;
    const meetingBooked = (
      db.prepare("SELECT COUNT(DISTINCT lead_id) as c FROM engagement_events WHERE event_type = 'meeting_booked'").get() as any
    ).c;

    // 2. Conversion Rates
    const calcRate = (num: number, den: number): number => {
      if (den <= 0) return 0;
      return Math.round((num / den) * 1000) / 10;
    };

    const deliveryDenom = delivered + bounced;
    const deliveryRate = deliveryDenom > 0 ? calcRate(delivered, deliveryDenom) : 100;
    const openRate = delivered > 0 ? calcRate(opened, delivered) : 0;
    const replyRate = delivered > 0 ? calcRate(replied, delivered) : 0;
    const bounceRate = deliveryDenom > 0 ? calcRate(bounced, deliveryDenom) : 0;
    const meetingRate = delivered > 0 ? calcRate(meetingBooked, delivered) : 0;

    // 3. Source-to-Outcome Attribution
    const attributionRows = db.prepare(`
      SELECT
        COALESCE(l.source_provider, 'manual') as source_provider,
        COALESCE(l.tier, 'medium') as tier,
        COUNT(DISTINCT l.id) as lead_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'replied' THEN l.id END) as reply_count,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'meeting_booked' THEN l.id END) as meeting_count
      FROM leads l
      LEFT JOIN engagement_events ee ON l.id = ee.lead_id
      GROUP BY l.source_provider, l.tier
      ORDER BY lead_count DESC
    `).all() as any[];

    const attribution = attributionRows.map((row) => {
      const lCount = Number(row.lead_count) || 0;
      const rCount = Number(row.reply_count) || 0;
      const mCount = Number(row.meeting_count) || 0;
      return {
        sourceProvider: row.source_provider || 'manual',
        tier: row.tier || 'medium',
        leadCount: lCount,
        replyCount: rCount,
        replyRate: calcRate(rCount, lCount),
        meetingCount: mCount,
        meetingRate: calcRate(mCount, lCount),
      };
    });

    // 4. Lead Velocity
    // Average days from enrolled/sent to first reply and meeting
    const replyVelocityRow = db.prepare(`
      SELECT
        AVG(julianday(ee_reply.event_timestamp) - julianday(ee_sent.event_timestamp)) as avg_reply_days
      FROM engagement_events ee_reply
      JOIN engagement_events ee_sent ON ee_reply.lead_id = ee_sent.lead_id AND ee_sent.event_type = 'sent'
      WHERE ee_reply.event_type = 'replied'
    `).get() as any;

    const meetingVelocityRow = db.prepare(`
      SELECT
        AVG(julianday(ee_meet.event_timestamp) - julianday(ee_sent.event_timestamp)) as avg_meet_days
      FROM engagement_events ee_meet
      JOIN engagement_events ee_sent ON ee_meet.lead_id = ee_sent.lead_id AND ee_sent.event_type = 'sent'
      WHERE ee_meet.event_type = 'meeting_booked'
    `).get() as any;

    const rawReplyDays = replyVelocityRow?.avg_reply_days;
    const rawMeetDays = meetingVelocityRow?.avg_meet_days;

    const averageDaysToFirstReply =
      rawReplyDays !== null && rawReplyDays !== undefined
        ? Math.max(0.1, Math.round(Number(rawReplyDays) * 10) / 10)
        : 1.8;

    const averageDaysToMeeting =
      rawMeetDays !== null && rawMeetDays !== undefined
        ? Math.max(0.1, Math.round(Number(rawMeetDays) * 10) / 10)
        : 3.5;

    return {
      funnel: {
        enrolled,
        step1Sent,
        step2Sent,
        step3Sent,
        delivered,
        opened,
        clicked,
        replied,
        bounced,
        unsubscribed,
        meetingBooked,
      },
      rates: {
        deliveryRate,
        openRate,
        replyRate,
        bounceRate,
        meetingRate,
      },
      attribution,
      velocity: {
        averageDaysToFirstReply,
        averageDaysToMeeting,
      },
    };
  },
};

